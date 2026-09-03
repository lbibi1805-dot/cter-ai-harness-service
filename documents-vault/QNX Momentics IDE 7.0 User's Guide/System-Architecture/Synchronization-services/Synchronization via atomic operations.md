---
title: "Synchronization via atomic operations"
category: "Synchronization-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, synchronization, mutex, semaphore]
---

# Synchronization via atomic operations

In some cases, you may want to perform a short operation (such as incrementing a variable) with the guarantee that the operation will perform _atomically_—i.e., the operation won't be preempted by another thread or ISR (Interrupt Service Routine).

The QNX Neutrino RTOS provides atomic operations for:

- adding a value
- subtracting a value
- clearing bits
- setting bits
- toggling (complementing) bits

These atomic operations are available by including the C header file <atomic.h>.

Although you can use these atomic operations just about anywhere, you'll find them particularly useful in these two cases:

- between an ISR and a thread
- between two threads (SMP or single-processor)

Since an ISR can preempt a thread at any given point, the only way that the thread would be able to protect itself would be to _disable interrupts_. Since you should avoid disabling interrupts in a realtime system, we recommend that you use the atomic operations provided with QNX Neutrino.

On an SMP system, multiple threads _can_ and _do_ run concurrently. Again, we run into the same situation as with interrupts above—you should use the atomic operations where applicable to eliminate the need to disable and reenable interrupts.

### Related reference  

[atomic_add_value()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/atomic_add_value.html "atomic_add_value()")

[atomic_add()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/atomic_add.html "atomic_add()")

[atomic_clr_value()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/atomic_clr_value.html "atomic_clr_value()")

[atomic_clr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/atomic_clr.html "atomic_clr()")

[atomic_set_value()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/atomic_set_value.html "atomic_set_value()")

[atomic_set()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/atomic_set.html "atomic_set()")

[atomic_sub_value()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/atomic_sub_value.html "atomic_sub_value()")

[atomic_sub()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/atomic_sub.html "atomic_sub()")

[atomic_toggle_value()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/atomic_toggle_value.html "atomic_toggle_value()")

[atomic_toggle()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/atomic_toggle.html "atomic_toggle()")
