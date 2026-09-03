---
title: "Events"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# Events
A significant feature in the kernel design for QNX Neutrino is the event-handling subsystem. POSIX and its realtime extensions define a number of asynchronous notification methods (e.g., UNIX signals that don't queue or pass data, POSIX realtime signals that may queue and pass data, etc.).

The kernel also defines additional, QNX Neutrino-specific notification techniques such as pulses. Implementing all of these event mechanisms could have consumed significant code space, so our implementation strategy was to build all of these notification methods over a single, rich, event subsystem.

A benefit of this approach is that capabilities exclusive to one notification technique can become available to others. For example, an application can apply the same queueing services of POSIX realtime signals to UNIX signals. This can simplify the robust implementation of signal handlers within applications.

The events encountered by an executing thread can come from any of three sources:

- a [MsgDeliverEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgdeliverevent.html) kernel call invoked by a thread
- an interrupt handler
- the expiry of a timer

The event itself can be any of a number of different types: QNX Neutrino pulses, interrupts, various forms of signals, and forced “unblock” events. “Unblock” is a means by which a thread can be released from a deliberately blocked state without any explicit event actually being delivered.

Given this multiplicity of event types, and applications needing the ability to request whichever asynchronous notification technique best suits their needs, it would be awkward to require that server processes (the higher-level threads from the previous section) carry code to support all these options.

Instead, the client thread can give a data structure, or “cookie,” called a [sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html) to the server to hang on to until later. When the server needs to notify the client thread, it invokes MsgDeliverEvent(), and the microkernel sets the event type encoded within the cookie upon the client thread.

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/sigevent.png) Figure 1. The client sends a sigevent to the server.

For details about the [sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html) structure, see the C Library Reference; for a description of how to use it, see “[Notification schemes](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer_Notification_schemes.html)” in the “Clocks, Timers, and Getting a Kick Every So Often” chapter of Getting Started with QNX Neutrino.

In a deeply embedded system that consists entirely of trusted programs, no safeguards are needed on events, but this isn't the case in systems that are more open. One problem with sigevents is that a server can deliver any event to a client, even if the client has never expressed an interest in receiving events. In QNX Neutrino 7.0.1 or later, the client can register events to make them more secure, as follows:

1. The client sets up the sigevent to indicate how it wants to be notified.
2. If the client wants to allow the server to update the value associated with the event, it sets the SIGEV_FLAG_UPDATEABLE flag in the event.
3. The client registers an event by calling [MsgRegisterEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgregisterevent.html). This function registers the given sigevent with the kernel, which stores the event internally and provides a handle for the event.
4. To prevent the delivery of unregistered events, the client sets the _NTO_COF_REG_EVENTS flag when it calls [ConnectAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/connectattach.html) to connect to the server.
5. The client gives the handle instead of the actual event to the server.
6. If the client set the SIGEV_FLAG_UPDATEABLE flag on the event, then the server is allowed to update the value included in the registered event.
7. When the server calls [MsgDeliverEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgdeliverevent.html) with a handle, the kernel looks up the handle. If the handle exists and the client has allowed the server to deliver it, the kernel delivers the corresponding registered event to the client.
8. When the client no longer needs the secure event, it can call [MsgUnregisterEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgunregisterevent.html) to remove it and unregister the handle.

The client can thus be sure that it gets only the events that it wants, and that no one has tampered with them. For a sample program, see the entry for [MsgRegisterEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgregisterevent.html) in the C Library Reference.

- **[I/O notification](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_IO_notification.html)**  
    The ionotify() function is a means by which a client thread can request asynchronous event delivery.

### Related concepts  

[Notification schemes (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer_Notification_schemes.html "Notification schemes (Getting Started with QNX Neutrino)")

### Related reference  

[ionotify()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/ionotify.html "ionotify()")

[MsgDeliverEvent(), MsgDeliverEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgdeliverevent.html "MsgDeliverEvent(), MsgDeliverEvent_r()")

[MsgReply(), MsgReply_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html "MsgReply(), MsgReply_r()")

[MsgSend(), MsgSend_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "MsgSend(), MsgSend_r()")

[struct sigevent](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigevent.html "struct sigevent")
