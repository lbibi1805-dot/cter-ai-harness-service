---
title: "mq_receive()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# mq_receive()
_Receive a message from a queue_

## Synopsis:

```c
#include <mqueue.h>

ssize_t mq_receive( mqd_t mqdes, 
                    char* msg_ptr, 
                    size_t msg_len,
                    unsigned int* msg_prio );
```

## Arguments:

**mqdes** —

The message-queue descriptor, returned by [mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "Open a message queue"), of the message queue that you want to get a message from.

**msg_ptr** —

A pointer to a buffer where the function can store the message received.

**msg_len** —

The message size of the given queue.

**msg_prio** —

NULL, or a pointer to a location where the function can store the priority of the message received.

## Library:

- For the traditional implementation, libc:
    
    Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.
    
- For the alternate implementation that uses the [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) server and a queue in kernel space, libmq:
    
    Use the -l mq option to qcc to link against this library.
    

## Description:

The mq_receive() function is used to receive the oldest of the highest priority messages in the queue specified by mqdes. The priority of the message received is put in the location pointed to by msg_prio, the data itself in the location pointed to by msg_ptr, and the size received is returned.

The message queue manager needs to be running. QNX Neutrino supports two implementations of message queues: a traditional implementation, and an alternate one that uses the mq server and a queue in kernel space. For more information, see the entries for [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) and [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html) in the Utilities Reference, as well as the [POSIX Message Queues: Two Implementations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html) technote.

If you call mq_receive() with a msg_len that's less than the mq_msgsize of the specified queue, then mq_receive() returns an error and sets errno to EMSGSIZE.

If there are no messages on the queue specified, and O_NONBLOCK wasn't set (in the oflag argument to mq_open()), then the mq_receive() call blocks. If multiple mq_receive() calls are blocked on a single queue, then they're unblocked in FIFO order as messages arrive.

In the traditional (mqueue) implementation, calling [read()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/r/read.html "Read bytes from a file") with mqdes is analogous to calling mq_receive() with a NULL msg_prio.

## Returns:

The size of the message removed from the queue. If the call fails, -1 is returned as the size, no message is removed from the queue, and [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set.

## Errors:

### `EAGAIN`

The O_NONBLOCK flag was set and there are no messages currently on the specified queue.

### `EBADF`

The mqdes argument doesn't represent a valid queue open for reading.

### `EINTR`

The operation was interrupted by a signal.

### `EINVAL`

The msg_ptr argument isn't a valid pointer.

### `EMSGSIZE`

The given msg_len is less than the mq_msgsize for the given queue _or_ the given msg_len is too short for the message that would have been received.

## Examples:

See the example for [mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html#mq_open__Examples).

## Classification:

[POSIX 1003.1 MSG](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|Yes|
> |Interrupt handler|No|
> |Signal handler|No|
> |Thread|Yes|

### Related concepts  

[POSIX message queues (System Architecture)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Message_queues.html "POSIX message queues (System Architecture)")

[POSIX Message Queues: Two Implementations (Technotes)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html "POSIX Message Queues: Two Implementations (Technotes)")

### Related reference  

[mq_close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_close.html "Close a message queue")

[mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "Open a message queue")

[mq_send()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_send.html "Send a message to a queue")

[mq_timedreceive(), mq_timedreceive_monotonic()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_timedreceive.html "Receive a message from a message queue")

[read()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/r/read.html "Read bytes from a file")

[mq (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html "mq (Utilities Reference)")

[mqueue (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html "mqueue (Utilities Reference)")
