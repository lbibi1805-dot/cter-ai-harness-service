---
title: "MsgRead(), MsgRead_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# MsgRead(), MsgRead_r()
_Read data from a message_

## Synopsis:

```c
#include <sys/neutrino.h>

ssize_t MsgRead( int rcvid, 
                 void* msg, 
                 size_t bytes, 
                 size_t offset );

ssize_t MsgRead_r( int rcvid, 
                   void* msg, 
                   size_t bytes, 
                   size_t offset );
```

## Arguments:

**rcvid** —

The value returned by MsgReceive*() when you received the message.

**msg** —

A pointer to a buffer where the function can store the data.

**bytes** —

The number of bytes that you want to read. This number must not exceed SSIZE_MAX, or the function will behave unpredictably.

These functions don't let you read past the end of the thread's message; they return the number of bytes actually read.

**offset** —

An offset into the thread's send message that indicates where you want to start reading the data.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The MsgRead() and MsgRead_r() kernel calls read data from a message sent by a thread identified by rcvid. The thread being read from must not have been replied to and will be in the REPLY-blocked state. The state of the sending thread doesn't change. Any thread in the receiving process is free to read the message.

These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgread.html#msgread__Returns) section for details.

If the sending and calling threads are on the same node, the data transfer occurs immediately and the calling thread doesn't block (see “Blocking states,” below).

You'll use these functions in these situations:

- A message is sent consisting of a fixed header and a variable amount of data. The header contains the byte count of the data. If the data is large and has to be inserted into one or more buffers (like a filesystem cache), rather than read the data into one large buffer and then copy it into several other buffers, MsgReceive() reads only the header, and you can call MsgRead() one or more times to read data directly into the required buffer(s).
- A message is received but can't be handled at the present time. At some point in the future, an event will occur that will allow the message to be processed. Rather than saving the message until it can be processed (thus using memory resources), you can use MsgRead() to reread the message, during which time the sending thread is still blocked.
- Messages that are larger than available buffer space are received. Perhaps the process is an agent between two processes and simply filters the data and passes it on. You can use MsgRead() to read the message in small pieces, and use MsgWrite*() to write the messages in small pieces.

When you're finished using MsgRead(), you must use MsgReply*() to ready the REPLY-blocked process and complete the message exchange.

**Blocking states**

None for the local case. In the network case:

STATE_REPLY

The calling thread is waiting for a network operation to complete. The calling thread is marked as REPLY-blocked on itself (the same process ID as the thread making the call).

**Native networking**

The MsgRead() function has increased latency when it's used to communicate across a network—a message pass is involved from the server to the network manager (at least). Depending on the size of the data transfer, the server's lsm-qnet.so and the client's lsm-qnet.so may need to communicate over the link to read more data bytes from the client.

## Returns:

The only difference between these functions is the way they indicate errors:

**MsgRead()** —

If successful, this function returns the number of bytes read. If an error occurs, it returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable").

**MsgRead_r()** —

If succesful, this function returns the number of bytes read. If an error occurs, it may return the negative of any value from the Errors section. This function does **NOT** set errno, even on success.

If you try to read past the end of the thread's message, the functions return the message size. If you don't try to read past the message's end, the functions return the requested number of bytes.

## Errors:

### `EDEADLK`

A deadlock occurred. You can avoid a deadlock by setting the _NTO_CHF_MSG_PAUSING flag when you create a channel; for more information, see [ChannelCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html "Create a communications channel") and [MsgPause()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgpause.html "Pause the processing of a message").

### `EFAULT`

A fault occurred in a server's address space when the kernel tried to access the server's message buffers.

### `ESRCH`

The thread indicated by rcvid doesn't exist, is no longer REPLY-blocked on the channel, or the connection was detached.

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

### Related concepts  

[Message Passing (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_msg.html "Message Passing (Getting Started with QNX Neutrino)")

### Related reference  

[MsgReadv(), MsgReadv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreadv.html "Read data from a message")

[MsgReceive(), MsgReceive_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "Wait for a message or pulse on a channel")

[MsgReceivev(), MsgReceivev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceivev.html "Wait for a message or pulse on a channel")

[MsgReply(), MsgReply_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html "Reply with a message")

[MsgReplyv(), MsgReplyv_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreplyv.html "Reply with a message")

[MsgWrite(), MsgWrite_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwrite.html "Write a reply")

[MsgWritev(), MsgWritev_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgwritev.html "Write a reply")
