---
title: "Scheduling priority"
category: "Thread-Scheduling"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, scheduling, priority]
---

# Scheduling priority

Every thread is assigned a priority. The thread scheduler selects the next thread to run by looking at the priority assigned to every thread that's READY (i.e., capable of using the CPU).

- On a single-core system, the READY thread with the highest priority is selected to run.
- On a multicore (SMP) system, the scheduler runs the highest-priority READY thread on one of the available cores. Additional cores run other threads in the system, though not necessarily the next highest-priority thread or threads; the scheduler is allowed some flexibility so that it can try to optimize cache usage and minimize thread migration. The next time a processor that's running a lower-priority thread makes a scheduling decision, it will choose the higher-priority one. Scheduling is also affected by _processor affinity_, which threads can use to specify which processors they can run on. For more information, see the [Multicore Processing](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/smp.html) chapter.

The following diagram shows the ready queue for a single-core system with five threads (B–F) that are READY. Thread A is currently running. All other threads (G–Z) are BLOCKED. Thread A, B, and C are at the highest priority, so they'll share the processor based on the running thread's scheduling policy.

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/readyq.png) Figure 1. The ready queue in a single-core system.

The OS supports a total of 256 scheduling priority levels. An unprivileged thread can set its priority to a level from 1 to 63 (the highest unprivileged priority), _independent of the scheduling policy_. Only threads with the PROCMGR_AID_PRIORITY ability enabled (see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html) in the C Library Reference) are allowed to set priorities above 63. The special _idle_ thread (in the process manager) has priority 0 and is always ready to run. A thread inherits the priority of its parent thread by default.

You can change the allowed priority range for unprivileged processes with the -P option for [procnto](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/p/procnto.html):

procnto-smp-instr -P priority

In QNX Neutrino 6.6 or later, you can append an s or S to this option if you want out-of-range priority requests by default to use the maximum allowed priority (reach a “maximum saturation point”) instead of resulting in an error. When you're setting a priority, you can wrap it in one these (non-POSIX) macros to specify how to handle out-of-range priority requests:

- SCHED_PRIO_LIMIT_ERROR(priority)—indicate an error
- SCHED_PRIO_LIMIT_SATURATE(priority)—use the maximum allowed priority

Here's a summary of the ranges:

|Priority level|Owner|
|---|---|
|0|Idle thread|
|1 through priority − 1|Unprivileged or privileged|
|priority through 255|Privileged|

Note that in order to prevent _priority inversion_, the kernel may temporarily boost a thread's priority. For more information, see “[Priority inheritance and mutexes](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Mutexes.html#Mutexes__Priority_inheritance)” later in this chapter, and “[Priority inheritance and messages](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Priority_inheritance_messages.html "A server process receives messages and pulses in priority order. As the threads within the server receive requests, they then inherit the priority (but not the scheduling policy) of the sending thread. As a result, the relative priorities of the threads requesting work of the server are preserved, and the server work will be executed at the appropriate priority. This message-driven priority inheritance avoids priority-inversion problems.")” in the Interprocess Communication (IPC) chapter. The initial priority of the kernel's threads is 255, but the first thing they all do is block in a [MsgReceive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html), so after that they operate at the priority of threads that send messages to them.

The threads on the ready queue are ordered by priority. The ready queue is actually implemented as 256 separate queues, one for each priority. The first thread in the highest-priority queue is selected to run.

Most of the time, threads are queued in FIFO order in the queue of their priority, but there are some exceptions:

- A non-FIFO server thread that's coming out of a RECEIVE-blocked state with a message sent by a client using an "nc" (non-cancellation point) variant of MsgSend*() is inserted at the head of the queue for that priority—that is, the order is LIFO, not FIFO.
- If a thread sends a message with an “nc” (non-cancellation point) variant of MsgSend*(), then when the server replies, the thread is placed at the front of the ready queue, rather than at the end. If the scheduling policy is round-robin, the thread's timeslice isn't replenished; for example, if the thread had already used half its timeslice before sending, then it still has only half a timeslice left before being eligible for preemption.

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
