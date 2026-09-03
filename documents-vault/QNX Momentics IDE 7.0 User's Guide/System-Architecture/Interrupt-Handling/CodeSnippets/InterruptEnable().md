---
title: "InterruptEnable()"
category: "Interrupt-Handling"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, interrupt]
---

# InterruptEnable()
_Enable hardware interrupts_

## Synopsis:

```c
#include <sys/neutrino.h>

void InterruptEnable( void );
```

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The InterruptEnable() function enables all hardware interrupts. You can call it from a thread or from an interrupt handler. Before calling this function:

- The process must have the PROCMGR_AID_IO ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").
- The calling thread must have obtained I/O privileges by calling:
    
    ThreadCtl( _NTO_TCTL_IO, 0 );
    

If you don't do these things, the thread might SIGSEGV when it calls InterruptEnable().

You should call this function as quickly as possible after calling [InterruptDisable()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptdisable.html "Disable hardware interrupts").

Use [InterruptLock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptlock.html "Guard a critical section in an interrupt handler") and [InterruptUnlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunlock.html "Release a critical section in an interrupt handler") instead of [InterruptDisable()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptdisable.html "Disable hardware interrupts") and InterruptEnable(). The InterruptLock() and InterruptUnlock() functions perform the intended function on SMP hardware, and allow your interrupt thread to run on any processor in the system.

The InterruptEnable() function doesn't support nesting. If a specific thread calls this function once and then calls it again without having disabled hardware interrupts, the second call has no effect.

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

[InterruptDisable()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptdisable.html "Disable hardware interrupts")

[InterruptLock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptlock.html "Guard a critical section in an interrupt handler")

[InterruptMask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptmask.html "Disable a hardware interrupt")

[InterruptStatus()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptstatus.html "Determine whether or not interrupts are enabled")

[InterruptUnlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunlock.html "Release a critical section in an interrupt handler")

[InterruptUnmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunmask.html "Enable a hardware interrupt")

[ThreadCtl(), ThreadCtl_r(), ThreadCtlExt(), ThreadCtlExt_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadctl.html "Control a thread")
