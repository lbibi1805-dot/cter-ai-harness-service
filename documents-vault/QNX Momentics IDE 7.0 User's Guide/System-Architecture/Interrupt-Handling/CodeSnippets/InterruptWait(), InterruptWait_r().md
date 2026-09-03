---
title: "InterruptWait(), InterruptWait_r()"
category: "Interrupt-Handling"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, interrupt]
---

# InterruptWait(), InterruptWait_r()

_Wait for a hardware interrupt_

## Synopsis:

```c
#include <sys/neutrino.h>

int InterruptWait( int flags,
                   const uint64_t * timeout );

int InterruptWait_r( int flags,
                     const uint64_t * timeout );
```

## Arguments:

**flags** —

This should currently be 0.

**timeout** —

This should currently be NULL. This may change in future versions.

Use [TimerTimeout()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state") to achieve a timeout.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

These kernel calls wait for a hardware interrupt. The calling thread should have attached a handler to the interrupt, by calling [InterruptAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "Attach an interrupt handler to an interrupt source") or [InterruptAttachEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattachevent.html "Attach an event to an interrupt source"). The call to InterruptWait() or InterruptWait_r() blocks waiting for an interrupt handler to return an event with notification type SIGEV_INTR (i.e., a hardware interrupt).

The InterruptWait() and InterruptWait_r() functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptwait.html#interruptwait__Returns) section for details.

If the notification event occurs before InterruptWait() is called, a pending flag is set. When InterruptWait() is called, the flag is checked; if set, it's cleared and the call immediately returns with success.

On a multicore system, a thread that calls InterruptWait() runs on any CPU, limited only by the scheduler and the runmask.

**Blocking states**

STATE_INTR

The thread is waiting for an interrupt handler to return a SIGEV_INTR event.

## Returns:

The only difference between these functions is the way they indicate errors:

InterruptWait()

If an error occurs, -1 is returned and [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set. Any other value returned indicates success.

InterruptWait_r()

EOK is returned on success. This function does **NOT** set errno. If an error occurs, any value in the Errors section may be returned.

## Errors:

### `EINTR`

The call was interrupted by a signal.

### `ENOTSUP`

The reserved arguments aren't NULL.

### `ETIMEDOUT`

A kernel timeout unblocked the call. See [TimerTimeout()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state").

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|Yes|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Writing an Interrupt Handler (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/inthandler.html "Writing an Interrupt Handler (QNX Neutrino Programmer's Guide)")

[Interrupts (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_inter.html "Interrupts (Getting Started with QNX Neutrino)")

### Related reference  

[InterruptAttach(), InterruptAttach_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "Attach an interrupt handler to an interrupt source")

[InterruptAttachArray(), InterruptAttachArray_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattacharray.html "Attach an interrupt handler (that returns an array of sigevents) to an interrupt source")

[InterruptAttachEvent(), InterruptAttachEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattachevent.html "Attach an event to an interrupt source")

[TimerTimeout(), TimerTimeout_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state")
