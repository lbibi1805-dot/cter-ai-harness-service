---
title: "mq_send()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# mq_send()
_Send a message to a queue_

## Synopsis:

```c
#include <mqueue.h>

int mq_send( mqd_t mqdes, 
             const char * msg_ptr, 
             size_t msg_len, 
             unsigned int msg_prio );
```

## Arguments:

**mqdes** —

The message-queue descriptor, returned by [mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "Open a message queue"), of the message queue that you want to send a message to.

**msg_ptr** —

A pointer to the message that you want to send.

**msg_len** —

The size of the message.

**msg_prio** —

The priority of the message, in the range from 0 through (MQ_PRIO_MAX - 1).

## Library:

- For the traditional implementation, libc:
    
    Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.
    
- For the alternate implementation that uses the [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) server and a queue in kernel space, libmq:
    
    Use the -l mq option to qcc to link against this library.
    

## Description:

The mq_send() function puts a message of size msg_len and pointed to by msg_ptr into the queue indicated by mqdes. The new message has a priority of msg_prio.

The message queue manager needs to be running. QNX Neutrino supports two implementations of message queues: a traditional implementation, and an alternate one that uses the mq server and a queue in kernel space. For more information, see the entries for [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) and [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html) in the Utilities Reference, as well as the [POSIX Message Queues: Two Implementations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html) technote.

The queue is maintained in priority order, and in FIFO order within the same priority.

If the number of elements on the specified queue is equal to its mq_maxmsg, and O_NONBLOCK wasn't set (in the oflag argument to mq_open()), the call to mq_send() blocks. It becomes unblocked when there's room on the queue to send the given message. If more than one mq_send() is blocked on a given queue, and space becomes available in that queue to send, then the mq_send() with the highest priority message is unblocked.

In the traditional (mqueue) implementation, calling [write()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/w/write.html "Write bytes to a file") with mqdes is analogous to calling mq_send() with a msg_prio of 0.

## Returns:

-1 if an error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set). Any other value indicates success.

## Errors:

### `EAGAIN`

The O_NONBLOCK flag was set when opening the queue, and the specified queue is full.

### `EBADF`

The mqdes argument doesn't represent a valid message queue descriptor, or mqdes wasn't opened for writing.

### `EINTR`

The call was interrupted by a signal.

### `EINVAL`

The value of msg_prio was greater than (MQ_PRIO_MAX - 1).

### `EMSGSIZE`

The msg_len argument was greater than the msgsize associated with the specified queue.

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

[mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html "Receive a message from a queue")

[mq_timedsend(), mq_timedsend_monotonic()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_timedsend.html "Send a message to a message queue")

[mq (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html "mq (Utilities Reference)")

[mqueue (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html "mqueue (Utilities Reference)")
