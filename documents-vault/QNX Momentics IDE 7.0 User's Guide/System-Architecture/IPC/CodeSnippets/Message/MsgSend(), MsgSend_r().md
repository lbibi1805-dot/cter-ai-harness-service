---
title: "MsgSend(), MsgSend_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# MsgSend(), MsgSend_r()

_Send a message to a channel_

## Synopsis:

```c
#include <sys/neutrino.h>

long MsgSend( int coid,
              const void* smsg,
              size_t sbytes,
              void* rmsg,
              size_t rbytes );

long MsgSend_r( int coid,
                const void* smsg,
                size_t sbytes,
                void* rmsg,
                size_t rbytes );
```

## Arguments:

**coid** —

The ID of the connection to the channel to send the message on, which you've established by calling [ConnectAttach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/connectattach.html "Establish a connection between a process and a channel") or one of its cover functions, such as [name_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/n/name_open.html "Open a name to connect to a server") or [open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/o/open.html "Open a file").

**smsg** —

A pointer to a buffer that contains the message that you want to send.

**sbytes** —

The number of bytes to send. This number must not exceed SSIZE_MAX, or the function will fail with EOVERFLOW.

**rmsg** —

A pointer to a buffer where the reply can be stored.

**rbytes** —

The size of the reply buffer, in bytes. This number must not exceed SSIZE_MAX, or the function will fail with EOVERFLOW.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The MsgSend() and MsgSend_r() kernel calls send a message to a process's channel via the connection identified by coid.

These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html#msgsend__Returns) section for details.

The number of bytes transferred is the minimum of that specified by both the sender and the receiver. The send data isn't allowed to overflow the receive buffer area provided by the receiver. The reply data isn't allowed to overflow the reply buffer area provided.

The sending thread becomes blocked waiting for a reply. If the receiving process has a thread that's RECEIVE-blocked on the channel, the transfer of data into its address space occurs immediately, and the receiving thread is unblocked and made ready to run. The sending thread becomes [REPLY-blocked](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html#msgsend__state_reply). If there are no waiting threads on the channel, the sending thread becomes [SEND-blocked](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html#msgsend__state_send) and is placed in a queue (perhaps with other threads). In this case, the actual transfer of data doesn't occur until a receiving thread receives on the channel. At this point, the sending thread becomes [REPLY-blocked](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html#msgsend__state_reply).

The receiving thread's effective priority might change when you send a message to it. For more information, see “[Priority inheritance and messages](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Priority_inheritance_messages.html)” in the Interprocess Communication (IPC) chapter of the System Architecture guide.

MsgSend() is a cancellation point for the ThreadCancel() kernel call; MsgSendnc() isn't.

**Blocking states**

STATE_SEND

The message has been sent but not yet received. If a thread is waiting to receive the message, this state is skipped and the calling thread goes directly to STATE_REPLY.

STATE_REPLY

The message has been received but not yet replied to. This state may be entered directly, or from STATE_SEND.

**Native networking**

When a client sends a message to a remote server, the client is effectively sending the message via its local microkernel; the network manager does the actual “work.” The local network manager negotiates with the remote network manager and causes the message to be delivered there. However, the remote manager is the one that actually delivers the message to the server.

This message transfer from the remote manager to the server is accomplished via a special nonblocking message pass.

The only impact on the client is the latency of the message-passing operations. This is purely a function of the network link speed and the overhead associated with the protocol (i.e. lsm-qnet.so for native networking) that io-pkt* uses.

The client still remains blocked in its MsgSend(), and unblocks only on account of a signal, a kernel timeout, or the completion of its function.

## Returns:

The only difference between MsgSend() and MsgSend_r() is the way they indicate errors:

**MsgSend()** —

If an error occurs in MsgSend() itself, the function returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") to a value from the Errors section. If the receiving thread calls [MsgError()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html "Unblock a client and set its error code") to unblock the sending thread, MsgSend() returns -1 and sets errno to the value passed to MsgError().

**MsgSend_r()** —

If an error occurs in MsgSend_r() itself, the function returns the negative of a value from the Errors section. If the receiving thread calls [MsgError()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html "Unblock a client and set its error code") to unblock the sending thread, MsgSend_r() returns the negative of the value passed to MsgError(). MsgSend_r() does **NOT** set errno, even on success.

Any other return value is the status from MsgReply*().

## Errors:

If the message passing itself failed, the errors include the following:

### `EBADF`

The connection indicated by coid is no longer connected to a channel, or the connection indicated by coid doesn't exist. The channel may have been terminated by the server, or the network manager if it failed to respond to multiple polls.

### `EFAULT`

A fault occurred when the kernel tried to access the buffers provided. This may have occurred on the receive or the reply.

### `EHOSTDOWN`

The host is down (e.g., a send across Qnet failed).

### `EHOSTUNREACH`

Unable to communicate with remote node (e.g., across Qnet).

### `EINTR`

The call was interrupted by a signal.

### `ESRCH`

The server died while the calling thread was SEND-blocked or REPLY-blocked.

### `ESRVRFAULT`

A fault occurred in a server's address space when the kernel tried to access the server's message buffers.

### `ETIMEDOUT`

A kernel timeout unblocked the call. See [TimerTimeout()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state").

If the message passing succeeded, but the server called MsgError(), the error code can be whatever the server wants it to be.

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|Yes|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

## Caveats:

The maximum size for a one-part message depends on the architecture:

- For 32-bit architectures, it's SSIZE_MAX (i.e., 231 − 1) bytes.
- For 64-bit architectures, the API allows up to SSIZE_MAX (i.e., 263 − 1) bytes, but the virtual address space limits the size to 239 bytes.

### Related concepts  

[Message Passing (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_msg.html "Message Passing (Getting Started with QNX Neutrino)")

### Related reference  

[ConnectAttach(), ConnectAttach_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/connectattach.html "Establish a connection between a process and a channel")

[MsgError(), MsgError_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html "Unblock a client and set its error code")

[MsgReceive(), MsgReceive_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "Wait for a message or pulse on a channel")

[MsgReceivev(), MsgReceivev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "Wait for a message or pulse on a channel")

[MsgReply(), MsgReply_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html "Reply with a message")

[MsgReplyv(), MsgReplyv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreplyv.html "Reply with a message")

[MsgSendnc(), MsgSendnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendnc.html "Send a message to a channel (non-cancellation point)")

[MsgSendPulse(), MsgSendPulse_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulse.html "Send a pulse to a process")

[MsgSendPulsePtr(), MsgSendPulsePtr_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulseptr.html "Send a pulse (containing a pointer) to a process")

[MsgSendsv(), MsgSendsv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendsv.html "Send a message to a channel")

[MsgSendsvnc(), MsgSendsvnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendsvnc.html "Send a message to a channel (non-cancellation point)")

[MsgSendv(), MsgSendv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendv.html "Send a message to a channel")

[MsgSendvnc(), MsgSendvnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvnc.html "Send a message to a channel (non-cancellation point)")

[MsgSendvs(), MsgSendvs_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvs.html "Send a message to a channel")

[MsgSendvsnc(), MsgSendvsnc_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendvsnc.html "Send a message to a channel (non-cancellation point)")

[name_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/n/name_open.html "Open a name to connect to a server")

[TimerTimeout(), TimerTimeout_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state")
