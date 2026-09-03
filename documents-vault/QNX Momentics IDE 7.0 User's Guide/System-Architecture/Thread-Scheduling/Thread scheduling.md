---
title: "Thread scheduling"
category: "Thread-Scheduling"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, scheduling, priority]
---

# Thread scheduling

When and how are scheduling decisions made?

The microkernel makes scheduling decisions whenever it's entered as the result of a kernel call, exception, or hardware interrupt. A scheduling decision is made whenever the execution state of any thread changes—it doesn't matter which processes the threads might reside within. Threads are scheduled globally across all processes.

Normally the running thread continues to run, but the thread scheduler will perform a context switch from one thread to another whenever the running thread:

- blocks
- is preempted
- yields

When does a thread block?

The running thread blocks when it must wait for some event to occur (response to an IPC request, wait on a mutex, etc.). The blocked thread is removed from the running array and the highest-priority ready thread is then run. When the blocked thread is subsequently unblocked, it's usually placed on the end of the ready queue for that priority level.

When is a thread preempted?

The running thread is preempted when a higher-priority thread is placed on the ready queue (it becomes READY, as the result of its block condition being resolved). The preempted thread is put at the beginning of the ready queue for that priority and the higher-priority thread runs.

When does a thread yield?

The running thread voluntarily yields the processor (e.g., via ([sched_yield()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sched_yield.html)) and is placed on the end of the ready queue for that priority. The highest-priority thread then runs (which may still be the thread that just yielded).

- **[Scheduling priority](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Scheduling_priority.html)**  
    Every thread is assigned a priority. The thread scheduler selects the next thread to run by looking at the priority assigned to every thread that's READY (i.e., capable of using the CPU).
- **[Scheduling policies](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_SchedulingAlgorithms.html)**  
    
- **[IPC issues](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_IPC_issues.html)**  
    Since all the threads in a process have unhindered access to the shared data space, wouldn't this execution model “trivially” solve all of our IPC problems? Can't we just communicate the data through shared memory and dispense with any other execution models and IPC mechanisms?
- **[Thread complexity issues](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Thread_complexity.html)**  
    Although threads are very appropriate for some system designs, it's important to respect the Pandora's box of complexities their use unleashes.

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
