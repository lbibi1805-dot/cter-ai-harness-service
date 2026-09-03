---
title: "Robust implementations with Send Receive Reply"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# Robust implementations with Send Receive Reply

Architecting a QNX Neutrino application as a team of cooperating threads and processes via Send/Receive/Reply results in a system that uses _synchronous_ notification. IPC thus occurs at specified transitions within the system, rather than asynchronously.

A significant problem with asynchronous systems is that event notification requires signal handlers to be run. Asynchronous IPC can make it difficult to thoroughly test the operation of the system and make sure that no matter when the signal handler runs, that processing will continue as intended. Applications often try to avoid this scenario by relying on a “window” explicitly opened and shut, during which signals will be tolerated.

With a synchronous, nonqueued system architecture built around Send/Receive/Reply, robust application architectures can be very readily implemented and delivered.

Avoiding deadlock situations is another difficult problem when constructing applications from various combinations of queued IPC, shared memory, and miscellaneous synchronization primitives. For example, suppose thread A doesn't release mutex 1 until thread B releases mutex 2. Unfortunately, if thread B is in the state of not releasing mutex 2 until thread A releases mutex 1, a standoff results. Simulation tools are often invoked in order to ensure that deadlock won't occur as the system runs.

The Send/Receive/Reply IPC primitives allow the construction of deadlock-free systems with the observation of only these simple rules:

1. Never have two threads send to each other.
2. Always arrange your threads in a hierarchy, with sends going up the tree.

The first rule is an obvious avoidance of the standoff situation, but the second rule requires further explanation. The team of cooperating threads and processes is arranged as follows:

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/thtree.png) Figure 1. Threads should always send up to higher-level threads.

Here the threads at any given level in the hierarchy never send to each other, but send only upwards instead.

One example of this might be a client application that sends to a database server process, which in turn sends to a filesystem process. Since the sending threads block and wait for the target thread to reply, and since the target thread isn't send-blocked on the sending thread, deadlock can't happen.

But how does a higher-level thread notify a lower-level thread that it has the results of a previously requested operation? (Assume the lower-level thread didn't want to wait for the replied results when it last sent.)

The QNX Neutrino RTOS provides a very flexible architecture with the [MsgDeliverEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgdeliverevent.html) kernel call to deliver nonblocking events. All of the common asynchronous services can be implemented with this. For example, the server-side of the [select()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/select.html) call is an API that an application can use to allow a thread to wait for an I/O event to complete on a set of file descriptors. In addition to an asynchronous notification mechanism being needed as a “back channel” for notifications from higher-level threads to lower-level threads, we can also build a reliable notification system for timers, hardware interrupts, and other event sources around this.

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/pulseven.png) Figure 2. A higher-level thread can “send” a pulse event.

A related issue is the problem of how a higher-level thread can request work of a lower-level thread without sending to it, risking deadlock. The lower-level thread is present only to serve as a “worker thread” for the higher-level thread, doing work on request. The lower-level thread would send in order to “report for work,” but the higher-level thread wouldn't reply then. It would defer the reply until the higher-level thread had work to be done, and it would reply (which is a nonblocking operation) with the data describing the work. In effect, the reply is being used to initiate work, not the send, which neatly side-steps rule #1.

### Related concepts  

[Priority inheritance and messages](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Priority_inheritance_messages.html "A server process receives messages and pulses in priority order. As the threads within the server receive requests, they then inherit the priority (but not the scheduling policy) of the sending thread. As a result, the relative priorities of the threads requesting work of the server are preserved, and the server work will be executed at the appropriate priority. This message-driven priority inheritance avoids priority-inversion problems.")

[Scheduling priority](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Scheduling_priority.html "Every thread is assigned a priority. The thread scheduler selects the next thread to run by looking at the priority assigned to every thread that's READY (i.e., capable of using the CPU).")

[Priorities and scheduling (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/overview_PRIOR.html "Priorities and scheduling (QNX Neutrino Programmer's Guide)")

[Priorities (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_Priorities.html "Priorities (Getting Started with QNX Neutrino)")

[The kernel as arbiter (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_Kernel_as_arbiter.html "The kernel as arbiter (Getting Started with QNX Neutrino)")

### Related reference  

[MsgDeliverEvent(), MsgDeliverEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgdeliverevent.html "MsgDeliverEvent(), MsgDeliverEvent_r()")

[MsgSend(), MsgSend_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "MsgSend(), MsgSend_r()")

[MsgSendPulse(), MsgSendPulse_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulse.html "MsgSendPulse(), MsgSendPulse_r()")

[select()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/select.html "select()")
