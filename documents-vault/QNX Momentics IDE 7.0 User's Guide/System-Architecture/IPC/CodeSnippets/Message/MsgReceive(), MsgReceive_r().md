---
title: "MsgReceive(), MsgReceive_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# MsgReceive(), MsgReceive_r()
_Wait for a message or pulse on a channel_

## Synopsis:

```c
#include <sys/neutrino.h>

int MsgReceive( int chid,
                void * msg,
                size_t bytes,
                struct _msg_info * info );

int MsgReceive_r( int chid,
                  void * msg,
                  size_t bytes,
                  struct _msg_info * info );
```

## Arguments:

**chid** —

The ID of a channel that you established by calling [ChannelCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html "Create a communications channel"), or -1 to dissociate the thread from the last channel it received on (see “[Server boost](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Server_boost.html)” in the Interprocess Communication chapter of the System Architecture guide).

**msg** —

A pointer to a buffer where the function can store the received data.

**bytes** —

The size of the buffer. This number must not exceed SSIZE_MAX, or the function will behave unpredictably.

**info** —

NULL, or a pointer to a [_msg_info](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/_msg_info.html "Information about a message") structure where the function can store additional information about the message.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The MsgReceive() and MsgReceive_r() kernel calls wait for a message or pulse to arrive on the channel identified by chid, and store the received data in the buffer pointed to by msg.

These functions are identical, except in the way they indicate errors; see the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html#msgreceive__Returns) section for details.

The number of bytes transferred is the minimum of that specified by both the sender and the receiver. The received data isn't allowed to overflow the receive buffer area provided.

The msg buffer _must_ be big enough to contain a pulse. If it isn't, the functions indicate an error of EFAULT.

If a message is waiting on the channel when you call MsgReceive(), the calling thread doesn't block, and the message is immediately copied. If a message isn't waiting, the calling thread enters the RECEIVE-blocked state until a message arrives.

If multiple messages are sent to a channel without a thread waiting to receive them, the messages are queued in priority order.

The thread's effective priority might change when it receives a message. For more information, see “[Priority inheritance and messages](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Priority_inheritance_messages.html)” in the Interprocess Communication (IPC) chapter of the System Architecture guide.

If you pass a non-NULL pointer for info, the functions store additional information about the message and the thread that sent it in the _msg_info structure that info points to. You can get this information later by calling [MsgInfo()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msginfo.html "Get additional information about a message").

On success, MsgReceive() and MsgReceive_r() return:

>0

A message was received; the returned value is a a rcvid (receive identifier). You'll use the rcvid with other Msg*() kernel calls to interact with and reply to the sending thread. MsgReceive() changes the state of the sending thread to REPLY-blocked when the message is received. When you use MsgReply*() to reply to the received message, the sending thread is made ready again. The rcvid encodes the sending thread's ID and a local connection ID.

0

A pulse was received; msg contains a pulse message of type [_pulse](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/_pulse.html "Structure that describes a pulse"). When a pulse is received, the kernel space allocated to hold it is immediately released. The _msg_info structure isn't updated.

Don't reply to a pulse.

**Blocking states**

STATE_RECEIVE

There's no message waiting.

**Native networking**

In networked message-passing transactions, the most noticeable impact is on the server. The server receives the client's message from the server's local lsm-qnet.so. Note that the receive ID that comes back from MsgReceive() will have some differences, but you don't need to worry about the format of the receive ID—just treat it as a “magic cookie.”

When the server unblocks from its MsgReceive(), it may or may not have received as much of the message as it would in the local case. This is because of the way that message passing is defined—the client and the server agree on the size of the message transfer area (the transmit parameters passed to MsgSend() on the client end) and the size of the message receive area on the server's MsgReceive().

In a local message pass, the kernel would ordinarily limit the size of the transfer to the minimum of both sizes. But in the networked case, the message is received by the client's lsm-qnet.so into its own private buffers and then sent via transport to the remote lsm-qnet.so. Since the size of the server's receive data area can't be known in advance by the client's lsm-qnet.so when the message is sent, only a fixed maximum size (currently 8 KB) message is transferred between the client and the server.

This means, for example, that if the client sends 1 Mbyte of data and the server issues a MsgReceive() with a 1-Mbyte data area, then only the number of bytes determined by a network manager would in fact be transferred. The number of bytes transferred to the server is returned via the last parameter to MsgReceive() or a call to MsgInfo(), specifically the msglen member of struct _msg_info. The client doesn't notice this, because it's still blocked.

You can use the following code to ensure that the desired number of bytes are received. Note that this is handled for you automatically when you're using the resource manager library:

rcvid = MsgReceive(chid, msg, nbytes, &info);

/*
 Doing a network transaction, and not all
 the message was sent, so get the rest...
*/
if (rcvid > 0 && info.srcmsglen > info.msglen && info.msglen < nbytes) {
   ssize_t n;

   if((n = MsgRead_r(rcvid, (char *) msg + info.msglen,
           nbytes - info.msglen, info.msglen)) < 0) {
       MsgError(rcvid, (int) -n);
       continue;
   }
   info.msglen += n;
}

## Returns:

On success, both functions return a positive rcvid if they received a message, or EOK if they received a pulse. The only difference between MsgReceive() and MsgReceive_r() is the way they indicate errors:

**MsgReceive()** —

If an error occurs, this function returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable").

**MsgReceive_r()** —

If an error occurs, this function may return the negative of any value from the Errors section. This function does **NOT** set errno, even on success.

## Errors:

### `EFAULT`

A fault occurred when the kernel tried to access the buffers provided. Because the OS accesses the sender's buffers only when MsgReceive() is called, a fault could occur _in the sender_ if the sender's buffers are invalid. If a fault occurs when accessing the sender buffers (only) they'll receive an EFAULT and MsgReceive() won't unblock.

This error also occurs if the kernel tries to deliver a pulse to the server, but the size of the receive buffer is less than the size of a struct _pulse. The pulse is lost in this case.

### `EINTR`

The call was interrupted by a signal.

### `ESRCH`

The channel indicated by chid doesn't exist.

### `ETIMEDOUT`

A kernel timeout unblocked the call. See [TimerTimeout()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state").

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

[ChannelCreate(), ChannelCreate_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html "Create a communications channel")

[_msg_info](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/_msg_info.html "Information about a message")

[MsgError(), MsgError_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html "Unblock a client and set its error code")

[MsgInfo(), MsgInfo_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msginfo.html "Get additional information about a message")

[MsgRead(), MsgRead_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgread.html "Read data from a message")

[MsgReadv(), MsgReadv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreadv.html "Read data from a message")

[MsgReceivePulse(), MsgReceivePulse_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivepulse.html "Receive a pulse on a channel")

[MsgReceivePulsev(), MsgReceivePulsev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivepulsev.html "Receive a pulse on a channel")

[MsgReceivev(), MsgReceivev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "Wait for a message or pulse on a channel")

[MsgReply(), MsgReply_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html "Reply with a message")

[MsgReplyv(), MsgReplyv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreplyv.html "Reply with a message")

[MsgSend(), MsgSend_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "Send a message to a channel")

[MsgWrite(), MsgWrite_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwrite.html "Write a reply")

[MsgWritev(), MsgWritev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwritev.html "Write a reply")

[_pulse](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/_pulse.html "Structure that describes a pulse")

[TimerTimeout(), TimerTimeout_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state")
