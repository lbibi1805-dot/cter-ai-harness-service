---
title: "mq_close()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# mq_close()
_Close a message queue_

## Synopsis:

```c
#include <mqueue.h>

int mq_close( mqd_t mqdes );
```

## Arguments:

**mqdes** —

The message-queue descriptor, returned by [mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "Open a message queue"), of the message queue that you want to close.

## Library:

- For the traditional implementation, libc:
    
    Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.
    
- For the alternate implementation that uses the [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) server and a queue in kernel space, libmq:
    
    Use the -l mq option to qcc to link against this library.
    

## Description:

The mq_close() function removes the association between mqdes and a message queue. If the current process attaches a notify to this queue for notification, the attachment is eliminated. If this queue is unlinked before the call to mq_close(), and this process is the last process to call mq_close() on the queue, then the queue is destroyed, along with its contents.

The message queue manager needs to be running. QNX Neutrino supports two implementations of message queues: a traditional implementation and an alternate one that uses the mq server and a queue in kernel space. For more information, see the entries for [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) and [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html) in the Utilities Reference, as well as the [POSIX Message Queues: Two Implementations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html) technote.

In the traditional (mqueue) implementation, calling [close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/close.html "Close a file") with mqdes has the same effect as calling mq_close().

## Returns:

-1 if an error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set). Any other value indicates success.

## Errors:

### `EBADF`

Invalid queue mqdes.

## Examples:

See the example for [mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html#mq_open__Examples).

## Classification:

[POSIX 1003.1 MSG](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|No|
> |Thread|Yes|

### Related concepts  

[POSIX message queues (System Architecture)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Message_queues.html "POSIX message queues (System Architecture)")

[POSIX Message Queues: Two Implementations (Technotes)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html "POSIX Message Queues: Two Implementations (Technotes)")

### Related reference  

[mq_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_open.html "Open a message queue")

[mq_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_unlink.html "Remove a queue")

[mq (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html "mq (Utilities Reference)")

[mqueue (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html "mqueue (Utilities Reference)")
