"""
Keep Windows from scheduling the voice service as disposable background work.

Measured on this project's laptop (i7-13650HX, a hybrid P-core/E-core CPU, on
the Balanced power plan): started detached in the background, the service
decoded at ~6 steps/s with the GPU idling in P4. Run in the foreground, the same
model did ~35. Autoregressive decoding spends much of each step dispatching small
GPU kernels from Python, so when Windows treats the process as low-priority
background work the CPU side slows and the GPU waits between kernels. Explicitly
raising the priority class moved the identical running service from RTF ~2.7 to
~1.0.

That experiment proved raising priority flips the slow state; it could not
separate priority from EcoQoS, because once flipped the process stayed fast.
So both are applied here, per process, and both end with the process:

  - opt out of EcoQoS (execution-speed power throttling), and
  - raise the priority class (AboveNormal by default, configurable).

A no-op on other platforms. Failure is logged and ignored: a slower voice service
still works, and the backend already treats a slow reply as "no audio this time".
"""

from __future__ import annotations

import ctypes
import logging
import sys

log = logging.getLogger("tts.process")

_PRIORITY_CLASSES = {
    "normal": 0x00000020,
    "abovenormal": 0x00008000,
    "high": 0x00000080,
}

# ProcessInformationClass value and flag from processthreadsapi.h.
_PROCESS_POWER_THROTTLING = 4
_THROTTLE_EXECUTION_SPEED = 0x1


def apply(priority: str, disable_ecoqos: bool) -> None:
    """Tune scheduling for the current process. Never raises."""
    if sys.platform != "win32":
        return
    try:
        from ctypes import wintypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        kernel32.SetPriorityClass.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        kernel32.SetProcessInformation.argtypes = [
            wintypes.HANDLE,
            ctypes.c_int,
            ctypes.c_void_p,
            wintypes.DWORD,
        ]
        handle = kernel32.GetCurrentProcess()

        if disable_ecoqos:

            class _ThrottlingState(ctypes.Structure):
                _fields_ = [
                    ("Version", wintypes.ULONG),
                    ("ControlMask", wintypes.ULONG),
                    ("StateMask", wintypes.ULONG),
                ]

            # ControlMask names the policy being set; StateMask 0 turns it off.
            state = _ThrottlingState(1, _THROTTLE_EXECUTION_SPEED, 0)
            if not kernel32.SetProcessInformation(
                handle, _PROCESS_POWER_THROTTLING, ctypes.byref(state), ctypes.sizeof(state)
            ):
                log.warning("could not opt out of EcoQoS (error %s)", ctypes.get_last_error())

        wanted = _PRIORITY_CLASSES.get(priority.strip().lower())
        if wanted is None:
            log.warning("unknown TTS_PROCESS_PRIORITY %r; leaving priority unchanged", priority)
        elif not kernel32.SetPriorityClass(handle, wanted):
            log.warning("could not set priority %s (error %s)", priority, ctypes.get_last_error())

        log.info("process tuning: priority=%s, ecoqos disabled=%s", priority, disable_ecoqos)
    except Exception:  # noqa: BLE001
        log.warning("process tuning failed; continuing with default scheduling", exc_info=True)
