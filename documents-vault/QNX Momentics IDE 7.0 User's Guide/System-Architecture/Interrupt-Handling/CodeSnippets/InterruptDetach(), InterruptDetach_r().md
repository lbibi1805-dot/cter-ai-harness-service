---
title: "InterruptDetach(), InterruptDetach_r()"
category: "Interrupt-Handling"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, interrupt]
---

# InterruptDetach(), InterruptDetach_r()

_Detach an interrupt handler by ID_

## Synopsis:

```c
#include <sys/neutrino.h>

int InterruptDetach( int id );

int InterruptDetach_r( int id );
```

## Arguments:

**id** —

An interrupt function ID, as returned by [InterruptAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "Attach an interrupt handler to an interrupt source"), [InterruptAttachArray()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattacharray.html "Attach an interrupt handler (that returns an array of sigevents) to an interrupt source"), [InterruptAttachEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattachevent.html "Attach an event to an interrupt source"), [InterruptHookIdle2()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interrupthookidle2.html "Attach an “idle” interrupt handler"), or [InterruptHookTrace()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interrupthooktrace.html "Attach the pseudo interrupt handler that the instrumented module uses").

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The InterruptDetach() and InterruptDetach_r() kernel calls detach the interrupt handler specified by the id argument. These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptdetach.html#interruptdetach__Returns) section for details.

If, after detaching, no thread is attached to the interrupt, then the interrupt is masked off. The thread that detaches the interrupt handler must be in the same process as the thread that attached it.

**Blocking states**

These calls don't block.

## Returns:

The only difference between these functions is the way they indicate errors:

InterruptDetach()

If an error occurs, -1 is returned and [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set. Any other value returned indicates success.

InterruptDetach_r()

EOK is returned on success. This function does **NOT** set errno. If an error occurs, any value in the Errors section may be returned.

## Errors:

### `EINVAL`

The value of id doesn't exist for this process.

### `EPERM`

The calling thread isn't in the process that attached the handler or event identified by id.

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

[InterruptAttachEvent(), InterruptAttachEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattachevent.html "Attach an event to an interrupt source")

[InterruptHookIdle2()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interrupthookidle2.html "Attach an “idle” interrupt handler")

[InterruptHookTrace()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interrupthooktrace.html "Attach the pseudo interrupt handler that the instrumented module uses")

[InterruptUnlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunlock.html "Release a critical section in an interrupt handler")
