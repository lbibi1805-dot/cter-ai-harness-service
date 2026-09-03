---
title: "Synchronous message passing"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# Synchronous message passing

Synchronous messaging is the main form of IPC in the QNX Neutrino RTOS.

A thread that does a [MsgSend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html) to another thread (which could be within another process) will be blocked until the target thread does a [MsgReceive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html), processes the message, and executes a [MsgReply()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html). If a thread executes a MsgReceive() without a previously sent message pending, it will block until another thread executes a MsgSend().

In QNX Neutrino, a server thread typically loops, waiting to receive a message from a client thread. As described earlier, a thread—whether a server or a client—is in the READY state if it can use the CPU. It might not actually be getting any CPU time because of its and other threads' priority and scheduling policy, but the thread isn't blocked.

Let's look first at the client thread:

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/states_client.png) Figure 1. Changes of state for a client thread in a send-receive-reply transaction.

- If the client thread calls MsgSend(), and the server thread hasn't yet called MsgReceive(), then the client thread becomes SEND blocked. Once the server thread calls MsgReceive(), the kernel changes the client thread's state to be REPLY blocked, which means that server thread has received the message and now must reply. When the server thread calls MsgReply(), the client thread becomes READY.
- If the client thread calls MsgSend(), and the server thread is already blocked on the MsgReceive(), then the client thread immediately becomes REPLY blocked, skipping the SEND-blocked state completely.
- If the server thread fails, exits, or disappears, the client thread becomes READY, with MsgSend() indicating an error.

Next, let's consider the server thread:

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/states_server.png) 
Figure 2. Changes of state for a server thread in a send-receive-reply transaction.

- If the server thread calls MsgReceive(), and no other thread has sent to it, then the server thread becomes RECEIVE blocked. When another thread sends to it, the server thread becomes READY.
- If the server thread calls MsgReceive(), and another thread has already sent to it, then MsgReceive() returns immediately with the message. In this case, the server thread doesn't block.
- If the server thread calls MsgReply(), it doesn't become blocked.

This inherent blocking synchronizes the execution of the sending thread, since the act of requesting that the data be sent also causes the sending thread to be blocked and the receiving thread to be scheduled for execution. This happens without requiring explicit work by the kernel to determine which thread to run next (as would be the case with most other forms of IPC). Execution and data move directly from one context to another.

Data-queuing capabilities are omitted from these messaging primitives because queueing could be implemented when needed within the receiving thread. The sending thread is often prepared to wait for a response; queueing is unnecessary overhead and complexity (i.e., it slows down the nonqueued case). As a result, the sending thread doesn't need to make a separate, explicit blocking call to wait for a response (as it would if some other IPC form had been used).

While the send and receive operations are blocking and synchronous, [MsgReply()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html) (or [MsgError()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html)) doesn't block. Since the client thread is already blocked waiting for the reply, no additional synchronization is required, so a blocking MsgReply() isn't needed. This allows a server to reply to a client and continue processing while the kernel and/or networking code asynchronously passes the reply data to the sending thread and marks it ready for execution. Since most servers will tend to do some processing to prepare to receive the next request (at which point they block again), this works out well.

Note that in a network, a reply may not complete as “immediately” as in a local message pass. For more information on network message passing, see the chapter on [Qnet networking](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/qnet.html "In the Interprocess Communication (IPC) chapter earlier in this manual, we described message passing in the context of a single node. But the true power of the QNX Neutrino RTOS lies in its ability to take the message-passing paradigm and extend it transparently over a network of microkernels. This chapter describes QNX Neutrino native networking (via the Qnet protocol).") in this book.

**MsgReply() vs MsgError()**

The [MsgReply()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html) function is used to return a status and zero or more bytes to the client. [MsgError()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html), on the other hand, is used to return _only_ a status to the client. Both functions will unblock the client from its [MsgSend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html).

### Related concepts  

[Message Passing (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_msg.html "Message Passing (Getting Started with QNX Neutrino)")

### Related reference  

[MsgCurrent(), MsgCurrent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgcurrent.html "MsgCurrent(), MsgCurrent_r()")

[MsgDeliverEvent(), MsgDeliverEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgdeliverevent.html "MsgDeliverEvent(), MsgDeliverEvent_r()")

[MsgError(), MsgError_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html "MsgError(), MsgError_r()")

[MsgInfo(), MsgInfo_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msginfo.html "MsgInfo(), MsgInfo_r()")

[MsgKeyData(), MsgKeyData_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgkeydata.html "MsgKeyData(), MsgKeyData_r()")

[MsgRead(), MsgRead_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgread.html "MsgRead(), MsgRead_r()")

[MsgReadv(), MsgReadv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreadv.html "MsgReadv(), MsgReadv_r()")

[MsgReceive(), MsgReceive_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "MsgReceive(), MsgReceive_r()")

[MsgReceivePulse(), MsgReceivePulse_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivepulse.html "MsgReceivePulse(), MsgReceivePulse_r()")

[MsgReceivePulsev(), MsgReceivePulsev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivepulsev.html "MsgReceivePulsev(), MsgReceivePulsev_r()")

[MsgReceivev(), MsgReceivev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "MsgReceivev(), MsgReceivev_r()")

[MsgReply(), MsgReply_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html "MsgReply(), MsgReply_r()")

[MsgReplyv(), MsgReplyv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreplyv.html "MsgReplyv(), MsgReplyv_r()")

[MsgSend(), MsgSend_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "MsgSend(), MsgSend_r()")

[MsgSendnc(), MsgSendnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendnc.html "MsgSendnc(), MsgSendnc_r()")

[MsgSendPulse(), MsgSendPulse_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulse.html "MsgSendPulse(), MsgSendPulse_r()")

[MsgSendsv(), MsgSendsv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendsv.html "MsgSendsv(), MsgSendsv_r()")

[MsgSendsvnc(), MsgSendsvnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendsvnc.html "MsgSendsvnc(), MsgSendsvnc_r()")

[MsgSendv(), MsgSendv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendv.html "MsgSendv(), MsgSendv_r()")

[MsgSendvnc(), MsgSendvnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvnc.html "MsgSendvnc(), MsgSendvnc_r()")

[MsgSendvs(), MsgSendvs_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvs.html "MsgSendvs(), MsgSendvs_r()")

[MsgSendvsnc(), MsgSendvsnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvsnc.html "MsgSendvsnc(), MsgSendvsnc_r()")

[MsgVerifyEvent(), MsgVerifyEvent_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgverifyevent.html "MsgVerifyEvent(), MsgVerifyEvent_r()")

[MsgWrite(), MsgWrite_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwrite.html "MsgWrite(), MsgWrite_r()")

[MsgWritev(), MsgWritev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwritev.html "MsgWritev(), MsgWritev_r()")
