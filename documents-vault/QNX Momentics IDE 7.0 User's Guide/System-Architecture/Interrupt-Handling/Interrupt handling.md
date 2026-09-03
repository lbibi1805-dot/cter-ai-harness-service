---
title: "Interrupt handling"
category: "Interrupt-Handling"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, interrupt]
---

# Interrupt handling

No matter how much we wish it were so, computers are not infinitely fast. In a realtime system, it's absolutely crucial that CPU cycles aren't unnecessarily spent. It's also crucial to minimize the time from the occurrence of an external event to the actual execution of code within the thread responsible for reacting to that event. This time is referred to as _latency_.

The two forms of latency that most concern us are interrupt latency and scheduling latency.

Latency times can vary significantly, depending on the speed of the processor and other factors. For more information, visit our website ([www.qnx.com](http://www.qnx.com/)).

- **[Interrupt latency](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Interrupt_latency.html)**  
    _Interrupt latency_ is the time from the assertion of a hardware interrupt until the first instruction of the device driver's interrupt handler is executed.
- **[Scheduling latency](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Scheduling_latency.html)**  
    In some cases, the low-level hardware interrupt handler must schedule a higher-level thread to run. In this scenario, the interrupt handler will return and indicate that an event is to be delivered. This introduces a second form of latency—_scheduling latency_—which must be accounted for.
- **[Nested interrupts](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Nested_interrupts.html)**  
    The QNX Neutrino RTOS fully supports nested interrupts.
- **[Interrupt calls](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Interrupt_calls.html)**  
    The interrupt-handling API includes the following kernel calls:

### Related concepts  

[Writing an Interrupt Handler (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/inthandler.html "Writing an Interrupt Handler (QNX Neutrino Programmer's Guide)")

[Interrupts (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_inter.html "Interrupts (Getting Started with QNX Neutrino)")

### Related reference  

[InterruptAttachEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattachevent.html "InterruptAttachEvent()")

[InterruptAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptattach.html "InterruptAttach()")

[InterruptDetach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptdetach.html "InterruptDetach()")

[InterruptDisable()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptdisable.html "InterruptDisable()")

[InterruptEnable()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptenable.html "InterruptEnable()")

[InterruptHookIdle2()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interrupthookidle2.html "InterruptHookIdle2()")

[InterruptHookTrace()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interrupthooktrace.html "InterruptHookTrace()")

[InterruptLock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptlock.html "InterruptLock()")

[InterruptMask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptmask.html "InterruptMask()")

[InterruptUnlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunlock.html "InterruptUnlock()")

[InterruptUnmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptunmask.html "InterruptUnmask()")

[InterruptWait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptwait.html "InterruptWait()")
