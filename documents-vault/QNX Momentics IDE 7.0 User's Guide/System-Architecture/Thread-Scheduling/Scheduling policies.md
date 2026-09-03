---
title: "Scheduling policies"
category: "Thread-Scheduling"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, scheduling, priority]
---

# Scheduling policies

To meet the needs of various applications, the QNX Neutrino RTOS provides these scheduling algorithms:

- FIFO scheduling
- round-robin scheduling
- sporadic scheduling

Each thread in the system may run using any method. The methods are effective on a per-thread basis, not on a global basis for all threads and processes on a node.

Remember that the FIFO and round-robin scheduling policies apply only when two or more threads that share the _same priority_ are READY (i.e., the threads are directly competing with each other). The sporadic method, however, employs a “budget” for a thread's execution. In all cases, if a higher-priority thread becomes READY, it immediately preempts all lower-priority threads.

In the following diagram, three threads of equal priority are READY. If Thread A blocks, Thread B will run.

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/ablocks.png) Figure 1. Thread A blocks; Thread B runs.

Although a thread inherits its scheduling policy from its parent process, the thread can request to change the algorithm applied by the kernel.

- **[FIFO scheduling](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_FIFO_scheduling.html)**  
    
- **[Round-robin scheduling](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Round_robin_scheduling.html)**  
    
- **[Sporadic scheduling](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sporadic_scheduling.html)**  
    The sporadic scheduling policy is generally used to provide a capped limit on the execution time of a thread _within a given period of time_.
- **[Manipulating priority and scheduling policies](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Manipulating.html)**  
    A thread's priority can vary during its execution, either from direct manipulation by the thread itself or from the kernel adjusting the thread's priority as it receives a message from a higher-priority thread.

### Related concepts  

[Priorities and scheduling (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/overview_PRIOR.html "Priorities and scheduling (QNX Neutrino Programmer's Guide)")

[Priorities (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_Priorities.html "Priorities (Getting Started with QNX Neutrino)")

[The kernel as arbiter (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_Kernel_as_arbiter.html "The kernel as arbiter (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_setschedparam()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_setschedparam.html "pthread_setschedparam()")

[pthread_setschedprio()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_setschedprio.html "pthread_setschedprio()")

[sched_setparam()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sched_setparam.html "sched_setparam()")

[sched_setscheduler()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sched_setscheduler.html "sched_setscheduler()")

[SchedSet(), SchedSet_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/schedset.html "SchedSet(), SchedSet_r()")
