---
title: "InterruptLock()"
category: "Interrupt-Handling"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, interrupt]
---

# InterruptLock()
_Guard a critical section in an interrupt handler_

## Synopsis:

```c
#include <sys/neutrino.h>

void InterruptLock( intrspin_t* spinlock );
```

## Arguments:

**spinlock** —

The spinlock (a variable shared between the interrupt handler and a thread) to use.

If spinlock isn't a static variable, you must initialize it by calling:

memset( spinlock, 0, sizeof( *spinlock ) );

before using it with InterruptLock().

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The InterruptLock() function guards a critical section by locking the specified spinlock. You can call this function from a thread or from an interrupt handler. Before calling this function:

- The process must have the PROCMGR_AID_IO ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").
- The calling thread must have obtained I/O privileges by calling:
    
    ThreadCtl( _NTO_TCTL_IO, 0 );
    

If you don't do these things, the thread might SIGSEGV when it calls InterruptLock().

This function tries to acquire the spinlock (a variable shared between the interrupt handler and a thread) while interrupts are disabled. The code spins in a tight loop until the lock is acquired. It's important to release the lock as soon as possible. Typically, this is a few lines of code without any loops:

InterruptLock( &spinner );

/* ... critical section */

InterruptUnlock( &spinner );

InterruptLock() solves a common need in many realtime systems to protect access to shared data structures between an interrupt handler and the thread that owns the handler. The traditional POSIX primitives used between threads aren't available for use by an interrupt handler.

The InterruptLock() and InterruptUnlock() functions work on single-processor or multiprocessor machines.

Any kernel call results in the re-enabling of interrupts, and many library routines are built on kernel calls. Masked interrupts aren't affected.

This function doesn't support nesting. If a specific thread calls InterruptLock() multiple times with different spinlocks and then calls InterruptUnlock() the same number of times and in reverse order with the locks, the first InterruptUnlock() call re-enables interrupts and the critical section is no longer protected.

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

[InterruptEnable()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptenable.html "Enable hardware interrupts")

[InterruptMask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptmask.html "Disable a hardware interrupt")

[InterruptUnlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunlock.html "Release a critical section in an interrupt handler")

[InterruptUnmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunmask.html "Enable a hardware interrupt")

[ThreadCtl(), ThreadCtl_r(), ThreadCtlExt(), ThreadCtlExt_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadctl.html "Control a thread")
