---
title: "Priority inheritance and messages"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# Priority inheritance and messages

A server process receives messages and pulses in priority order. As the threads within the server receive requests, they then inherit the priority (but not the scheduling policy) of the sending thread. As a result, the relative priorities of the threads requesting work of the server are preserved, and the server work will be executed at the appropriate priority. This message-driven priority inheritance avoids priority-inversion problems.

For example, suppose the system includes the following:

- a server thread, at priority 22
- a client thread, T1, at priority 13
- a client thread, T2, at priority 10

Without priority inheritance, if T2 sends a message to the server, it's effectively getting work done for it at priority 22, so T2's priority has been inverted.

What actually happens is that when the server receives a message, its effective priority changes to that of the highest-priority sender (restricted as described below). In this case, T2's priority is lower than the server's, so the change in the server's effective priority takes place when the server _receives_ the message.

Next, suppose that T1 sends a message to the server while it's still at priority 10. Since T1's priority is higher than the server's current priority, the change in the server's priority happens when T1 _sends_ the message.

The change happens before the server receives the message to avoid another case of priority inversion. If the server's priority remains unchanged at 10, and another thread, T3, starts to run at priority 11, the server has to wait until T3 lets it have some CPU time so that it can eventually receive T1's message. So, T1 would be delayed by a lower-priority thread, T3.

If the highest priority among the threads is a privileged priority, and the server doesn't have the PROCMGR_AID_PRIORITY ability enabled, then the server thread is boosted to the highest unprivileged priority. For more information, see “[Scheduling priority](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Scheduling_priority.html "Every thread is assigned a priority. The thread scheduler selects the next thread to run by looking at the priority assigned to every thread that's READY (i.e., capable of using the CPU).")” in the “QNX Neutrino Microkernel” chapter and [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html) in the C Library Reference.

You can turn off priority inheritance by specifying the _NTO_CHF_FIXED_PRIORITY flag when you call [ChannelCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html). If you're using adaptive partitioning, this flag also causes the receiving threads not to run in the sending threads' partitions.

- **[Server boost](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Server_boost.html)**  
    If a high-priority thread becomes SEND-blocked on a server, the kernel tries to find one or more threads that are likely to receive on the given channel, and then it boosts their priorities.

### Related concepts  

[Scheduling priority](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Scheduling_priority.html "Every thread is assigned a priority. The thread scheduler selects the next thread to run by looking at the priority assigned to every thread that's READY (i.e., capable of using the CPU).")

[Priorities and scheduling (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/overview_PRIOR.html "Priorities and scheduling (QNX Neutrino Programmer's Guide)")

[Priorities (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_Priorities.html "Priorities (Getting Started with QNX Neutrino)")

[The kernel as arbiter (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_Kernel_as_arbiter.html "The kernel as arbiter (Getting Started with QNX Neutrino)")

[Adaptive Partitioning User's Guide](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.adaptivepartitioning.userguide/topic/about_howtouseguide_.html "Adaptive Partitioning User's Guide")

### Related reference  

[ChannelCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html "ChannelCreate()")
