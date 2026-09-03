---
title: "InterruptAttachEvent(), InterruptAttachEvent_r()"
category: "Interrupt-Handling"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, interrupt]
---

# InterruptAttachEvent(), InterruptAttachEvent_r()

_Attach an event to an interrupt source_

## Synopsis:

```c
#include <sys/neutrino.h>

int InterruptAttachEvent( 
       int intr,
       const struct sigevent* event,
       unsigned flags );

int InterruptAttachEvent_r( 
       int intr,
       const struct sigevent* event,
       unsigned flags );
```

## Arguments:

**intr** —

The _interrupt vector number_ that you want to attach an event to; for more information, see “[Interrupt vector numbers](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html#interruptattach__ivn)” in the documentation for [InterruptAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "Attach an interrupt handler to an interrupt source").

**event** —

A pointer to the [sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html "Structure that describes an event") structure that you want to be delivered when this interrupt occurs.

**flags** —

Flags that specify how you want to attach the interrupt handler; a bitwise OR of zero or more of the following:

- _NTO_INTR_FLAGS_END
- _NTO_INTR_FLAGS_NO_UNMASK (QNX Neutrino 6.6 or later)
- _NTO_INTR_FLAGS_PROCESS
- _NTO_INTR_FLAGS_TRK_MSK
- _NTO_INTR_FLAGS_EXCLUSIVE (QNX Neutrino 7.0.4 or later)

For more information, see “[Flags](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattachevent.html#interruptattachevent__Flags),” below.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The InterruptAttachEvent() and InterruptAttachEvent_r() kernel calls attach the given event to the hardware interrupt specified by intr. They automatically enable (i.e., unmask) the interrupt level. These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattachevent.html#interruptattachevent__Returns) section for details.

Before calling either of these functions, the process must have the PROCMGR_AID_INTERRUPTEVENT or PROCMGR_AID_INTERRUPT ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

If the thread doesn't have the appropriate abilities, the call to InterruptAttachEvent() fails with an error of EPERM.

To prevent infinite interrupt recursion, the kernel automatically does an [InterruptMask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptmask.html "Disable a hardware interrupt") for intr when delivering the event. After the interrupt-handling thread has dealt with the event, it must call [InterruptUnmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunmask.html "Enable a hardware interrupt") to reenable the interrupt.

Consider the following when choosing an event type:

- Message-driven processes that block in a receive loop using [MsgReceivev()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "Wait for a message or pulse on a channel") should consider using SIGEV_PULSE to trigger a channel.
- Threads that block at a particular point in their code and don't go back to a common receive point, should consider using SIGEV_INTR as the event notification type and [InterruptWait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptwait.html "Wait for a hardware interrupt") as the blocking call.
    
    The thread that calls InterruptWait() _must_ be the one that called InterruptAttachEvent().
    
- Using SIGEV_THREAD is very inefficient, because that would create a new thread for every interrupt.
    
    (QNX Neutrino 7.0.4 or later) In order to use an event of type SIGEV_THREAD, your process must have the PROCMGR_AID_SIGEV_THREAD ability enabled.
    
- For SIGEV_SIGNAL, SIGEV_SIGNAL_CODE, and SIGEV_SIGNAL_THREAD, handling a signal using a signal handler is noticeably inefficient as compared to using pulses. But, delivering a signal to a thread that's blocked on sigwaitinfo() is actually more efficient than the pulse choice, though less efficient than the InterruptWait() choice. The advantage is in flexibility, allowing the thread to be woken up both by interrupts and by other threads in the process as needed. Architecturally, this lets you create a thread that's dedicated to handling hardware.

On a multicore system, the thread that receives the event set up by InterruptAttachEvent() runs on any CPU, limited only by the scheduler and the runmask.

**Flags**

The flags argument is a bitwise OR of zero or more of the following values:

_NTO_INTR_FLAGS_END

Put the new event at the end of the list of existing events instead of the start.

The interrupt structure allows hardware interrupts to be shared. For example if two processes call InterruptAttachEvent() for the same physical interrupt, both events are sent consecutively. When an event attaches, it's placed in front of any existing events for that interrupt and is delivered first. You can change this behavior by setting _NTO_INTR_FLAGS_END.

_NTO_INTR_FLAGS_NO_UNMASK

(QNX Neutrino 6.6 or later) Leave the interrupt masked.

Normally, InterruptAttach() and InterruptAttachEvent() automatically unmask an interrupt the first time something is attached to it. If you specify _NTO_INTR_FLAGS_NO_UNMASK, the kernel leaves the interrupt masked, and you must specifically call [InterruptUnmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunmask.html "Enable a hardware interrupt") to enable it.

_NTO_INTR_FLAGS_PROCESS

Associate the interrupt event with the _process_ instead of the attaching thread. The interrupt event is removed when the process exits, instead of when the attaching thread exits.

The kernel automatically sets the _NTO_INTR_FLAGS_PROCESS flag if the event is directed at the process in general (for SIGEV_SIGNAL, SIGEV_SIGNAL_CODE, and SIGEV_PULSE events).

_NTO_INTR_FLAGS_TRK_MSK

Track calls to [InterruptMask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptmask.html "Disable a hardware interrupt") and [InterruptUnmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunmask.html "Enable a hardware interrupt") to make detaching the interrupt handler safer.

The _NTO_INTR_FLAGS_TRK_MSK flag and the id argument to InterruptMask() and InterruptUnmask() let the kernel track the number of times a particular interrupt handler or event has been masked. Then, when an application detaches from the interrupt, the kernel can perform the proper number of unmasks to ensure that the interrupt functions normally. This is important for shared interrupt levels.

You should always set _NTO_INTR_FLAGS_TRK_MSK.

_NTO_INTR_FLAGS_EXCLUSIVE

(QNX Neutrino 7.0.4 or later) Request exclusive access to the interrupt vector. If another thread already called an InterruptAttach*() function with the same vector, this kernel call fails with an EBUSY error. Similarly, if this call succeeds but another thread later calls an InterruptAttach*() function with the same vector, that call fails with the same error.

**Advantages & disadvantages**

InterruptAttachEvent() has several advantages over [InterruptAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "Attach an interrupt handler to an interrupt source"):

- Less work is done at interrupt time (you avoid the context switch necessary to map in an interrupt handler).
- Interrupt handling code runs at the thread's priority, which lets you specify the priority of the interrupt handling.
- You can use process-level debugging on your interrupt handler code.
- It isn't safe to use floating-point operations in Interrupt Service Routines.

There are also some disadvantages:

- There might be a delay before the interrupt handling code runs (until the thread is scheduled to run).
- For multiple devices sharing an event, the amount of time spent with the interrupt masked increases.

You can freely mix calls to [InterruptAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "Attach an interrupt handler to an interrupt source") and InterruptAttachEvent() for a particular interrupt.

**Blocking states**

These calls don't block.

## Returns:

An interrupt function ID. If an error occurs:

- InterruptAttachEvent() returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable").
- InterruptAttachEvent_r() returns the negative of a value from the Errors section and **doesn't** set errno.

Use the ID with [InterruptDetach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptdetach.html "Detach an interrupt handler by ID") to detach this interrupt event.

## Errors:

### `EAGAIN`

All kernel interrupt entries are in use.

### `EFAULT`

A fault occurred when the kernel tried to access the buffers provided.

### `EINVAL`

The value of intr isn't a valid interrupt number.

### `EPERM`

The process doesn't have the required permission; see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Writing an Interrupt Handler (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/inthandler.html "Writing an Interrupt Handler (QNX Neutrino Programmer's Guide)")

[Interrupts (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_inter.html "Interrupts (Getting Started with QNX Neutrino)")

### Related reference  

[InterruptAttach(), InterruptAttach_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "Attach an interrupt handler to an interrupt source")

[InterruptAttachArray(), InterruptAttachArray_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattacharray.html "Attach an interrupt handler (that returns an array of sigevents) to an interrupt source")

[InterruptCharacteristic(), InterruptCharacteristic_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptcharacteristic.html "Get or set a characteristic associated with an interrupt")

[InterruptDetach(), InterruptDetach_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptdetach.html "Detach an interrupt handler by ID")

[InterruptLock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptlock.html "Guard a critical section in an interrupt handler")

[InterruptMask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptmask.html "Disable a hardware interrupt")

[InterruptUnlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunlock.html "Release a critical section in an interrupt handler")

[InterruptUnmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunmask.html "Enable a hardware interrupt")

[InterruptWait(), InterruptWait_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptwait.html "Wait for a hardware interrupt")

[procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")

[sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html "Structure that describes an event")
