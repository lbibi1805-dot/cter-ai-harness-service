---
title: "MsgReply(), MsgReply_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# MsgReply(), MsgReply_r()

_Reply with a message_

## Synopsis:

```c
#include <sys/neutrino.h>

int MsgReply( int rcvid,
              long status,
              const void* msg,
              size_t bytes );

int MsgReply_r( int rcvid,
                long status,
                const void* msg,
                size_t bytes );
```

## Arguments:

**rcvid** —

The receive ID that MsgReceive*() returned when you received the message.

**status** —

The status to use when unblocking the client's MsgSend*() call in the rcvid thread.

The MsgSend*_r() functions return negative errno values to indicate failure, so you shouldn't pass a negative value for the status to MsgReply*(), because the MsgSend*_r() functions could interpret it as an error code. If you wish to indicate an error, call [MsgError()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html "Unblock a client and set its error code").

**msg** —

A pointer to a buffer that contains the message that you want to reply with.

**bytes** —

The size of the message, in bytes. This number must not exceed SSIZE_MAX, or the function will behave unpredictably.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The MsgReply() and MsgReply_r() kernel calls reply with a message to the thread identified by rcvid. The thread being replied to must be in the REPLY-blocked state. Any thread in the receiving process is free to reply to the message, however, it may be replied to only once for each receive.

These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html#msgreply__Returns) section for details.

The MsgSend*() in the rcvid thread unblocks with a return value of status.

The number of bytes transferred is the minimum of that specified by both the replier and the sender. The reply data isn't allowed to overflow the reply buffer area provided by the sender.

In the local case, the data transfer occurs immediately, and the replying task doesn't block (see “Blocking states,” below). There's no need to reply to received messages in any particular order, but you must eventually reply to each message to allow the sending thread(s) to continue execution.

**Blocking states**

None for the local case. In the network case:

STATE_REPLY

The calling thread is waiting for a network operation to complete. The calling thread is marked as REPLY-blocked on itself (the same process ID as the thread making the call).

**Native networking**

The MsgReply() function has increased latency when it's used to communicate across a network—the server is now writing data to its local lsm-qnet.so, which may need to communicate with the client's lsm-qnet.so to actually transfer the data.

## Returns:

The only difference between the MsgReply() and MsgReply_r() functions is the way they indicate errors:

MsgReply()

If successful, this function returns EOK. If an error occurs, it returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable").

MsgReply_r()

If successful, this function returns EOK. If an error occurs, it may return the negative of any value from the Errors section. This function does **NOT** set errno, even on success.

## Errors:

### `EDEADLK`

A deadlock occurred. You can avoid a deadlock by setting the _NTO_CHF_MSG_PAUSING flag when you create a channel; for more information, see [ChannelCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html "Create a communications channel") and [MsgPause()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgpause.html "Pause the processing of a message").

### `EFAULT`

A fault occurred in the sender's address space when a server tried to access the sender's return message buffers.

### `ENOREMOTE`

The reply has to go across the network, and Qnet isn't running.

### `ESRCH`

The thread indicated by rcvid doesn't exist, or is no longer REPLY-blocked on the channel, or the connection was detached.

### `ESRVRFAULT`

A fault occurred when the kernel tried to access the buffers provided.

### `ETIMEDOUT`

A kernel timeout unblocked the call. See [TimerTimeout()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state").

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
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

[MsgError(), MsgError_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgerror.html "Unblock a client and set its error code")

[MsgReceive(), MsgReceive_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "Wait for a message or pulse on a channel")

[MsgReceivev(), MsgReceivev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "Wait for a message or pulse on a channel")

[MsgReplyv(), MsgReplyv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreplyv.html "Reply with a message")

[MsgSend(), MsgSend_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "Send a message to a channel")

[MsgSendv(), MsgSendv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendv.html "Send a message to a channel")

[MsgWrite(), MsgWrite_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwrite.html "Write a reply")

[MsgWritev(), MsgWritev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwritev.html "Write a reply")
