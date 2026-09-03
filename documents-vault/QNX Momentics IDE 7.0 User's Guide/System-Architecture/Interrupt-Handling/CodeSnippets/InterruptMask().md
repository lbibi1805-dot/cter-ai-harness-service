---
title: "InterruptMask()"
category: "Interrupt-Handling"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, interrupt]
---

# InterruptMask()
_Disable a hardware interrupt_

## Synopsis:

```c
#include <sys/neutrino.h>

int InterruptMask( int intr, 
                   int id );
```

## Arguments:

**intr** —

The interrupt you want to mask.

**id** —

The value returned by [InterruptAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "Attach an interrupt handler to an interrupt source"), [InterruptAttachArray()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattacharray.html "Attach an interrupt handler (that returns an array of sigevents) to an interrupt source"), or [InterruptAttachEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattachevent.html "Attach an event to an interrupt source"), or -1 if you don't want the kernel to track interrupt maskings and unmaskings for each handler.

If you set the [_NTO_INTR_FLAGS_TRK_MSK](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html#interruptattach__flags_trk_msk) flag when calling the interrupt attach function, you must pass in a proper ID value (not -1). This ID value, along with the flag setting, allows better error recovery if a process unexpectedly terminates because it lets the kernel know how many times to call InterruptUnmask().

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The InterruptMask() kernel call disables the hardware interrupt specified by intr for the handler specified by id. You can call this function from a thread or from an interrupt handler.

If id isn't -1, the calling thread must be in the process that attached the interrupt. Otherwise the function fails with an error of EPERM.

If id is -1, then before you call this function from a thread:

- The process must have the PROCMGR_AID_IO ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").
- The calling thread must have obtained I/O privileges by calling ThreadCtl( _NTO_TCTL_IO, 0 ).

If you're in an ISR, you must have had proper permissions, so the call will never fail for that reason.

Reenable the interrupt by calling [InterruptUnmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunmask.html "Enable a hardware interrupt").

The kernel automatically enables an interrupt when the first handler attaches to it using [InterruptAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "Attach an interrupt handler to an interrupt source") and disables it when the last handler detaches.

This call is often used when a device presents a level-sensitive interrupt to the system that can't be easily cleared in the interrupt handler. Since the interrupt is level-sensitive, you can't exit the handler with the interrupt line active and unmasked. InterruptMask() lets you mask the interrupt in the handler and schedule a thread to do the real work of communicating with the device to clear the source. Once cleared, the thread should call InterruptUnmask() to reenable this interrupt.

To disable all hardware interrupts, use the [InterruptLock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptlock.html "Guard a critical section in an interrupt handler") function.

To ensure hardware portability, use InterruptMask() instead of writing code that talks directly to the interrupt controller.

Calls to InterruptMask() are counted; the interrupt isn't unmasked until [InterruptUnmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunmask.html "Enable a hardware interrupt") has been called once for every call to InterruptMask().

## Returns:

The current mask level count for success; or -1 if an error occurs ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set).

## Errors:

### `EINVAL`

The value of intr isn't a supported hardware interrupt.

### `ESRCH`

The id parameter is neither something returned by [InterruptAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "Attach an interrupt handler to an interrupt source"), [InterruptAttachArray()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattacharray.html "Attach an interrupt handler (that returns an array of sigevents) to an interrupt source"), or [InterruptAttachEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattachevent.html "Attach an event to an interrupt source"), nor -1.

### `EPERM`

The function was called from a thread other than the one that called one of the InterruptAttach*() functions and obtained id, or the caller didn't request I/O privileges by first calling ThreadCtl( _NTO_TCTL_IO, 0 ).

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|Yes|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Writing an Interrupt Handler (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/inthandler.html "Writing an Interrupt Handler (QNX Neutrino Programmer's Guide)")

[Interrupts (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_inter.html "Interrupts (Getting Started with QNX Neutrino)")

### Related reference  

[InterruptAttach(), InterruptAttach_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "Attach an interrupt handler to an interrupt source")

[InterruptAttachArray(), InterruptAttachArray_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattacharray.html "Attach an interrupt handler (that returns an array of sigevents) to an interrupt source")

[InterruptAttachEvent(), InterruptAttachEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattachevent.html "Attach an event to an interrupt source")

[InterruptDisable()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptdisable.html "Disable hardware interrupts")

[InterruptEnable()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptenable.html "Enable hardware interrupts")

[InterruptLock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptlock.html "Guard a critical section in an interrupt handler")

[InterruptUnlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunlock.html "Release a critical section in an interrupt handler")

[InterruptUnmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunmask.html "Enable a hardware interrupt")

[ThreadCtl(), ThreadCtl_r(), ThreadCtlExt(), ThreadCtlExt_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadctl.html "Control a thread")
