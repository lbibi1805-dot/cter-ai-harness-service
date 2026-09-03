---
title: "mq_open()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# mq_open()
_Open a message queue_

## Synopsis:

```c
#include <mqueue.h>
#include <fcntl.h>

mqd_t mq_open( const char * name, 
               int oflag,
               ... )
```

## Arguments:

**name** —

The name of the message queue that you want to open; see below.

**oflag** —

You must specify one of O_RDONLY (receive-only), O_WRONLY (send-only) or O_RDWR (send-receive). In addition, you can OR in the following constants to produce the following effects:

- O_CREAT — if name doesn't exist, instruct the server to create a new message queue with the given name. If you specify this flag, mq_open() uses its mode and mq_attr arguments; see below.
- O_EXCL — if you set both O_EXCL and O_CREAT, and a message queue name exists, the call fails and errno is set to EEXIST. Otherwise, the queue is created normally. If you set O_EXCL without O_CREAT, it's ignored.
- O_NONBLOCK — under normal message queue operation, a call to mq_send() or mq_receive() could block if the message queue is full or empty. If you set this flag, these calls never block. If the queue isn't in a condition to perform the given call, errno is set to EAGAIN and the call returns an error.

If you set O_CREAT in the oflag argument, you must also pass these arguments to mq_open():

**mode_t mode** —

The file permissions for the new queue. For more information, see the entry for [struct stat](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/stat_struct.html "Data structure for information about a file or directory").

If you set any bits other than file permission bits, they're ignored. Read and write permissions are analogous to receive and send permissions; execute permissions are ignored.

struct mq_attr *mq_attr

NULL, or a pointer to an mq_attr structure that contains the attributes that you want to use for the new queue. For more information, see [mq_getattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_getattr.html "Get a message queue's attributes").

If mq_attr is NULL, the following default attributes are used—depending on which implementation of message queues you're using—provided that you didn't override the defaults when you started the message-queue server:

|Attribute|Traditional|Alternate|
|---|---|---|
|mq_maxmsg|1024|64|
|mq_msgsize|4096|256|
|mq_flags|0|0|

If mq_attr isn't NULL, the new queue adopts the mq_maxmsg and mq_msgsize of mq_attr. The mq_flags flags field is ignored.

## Library:

- For the traditional implementation, libc:
    
    Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.
    
- For the alternate implementation that uses the [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) server and a queue in kernel space, libmq:
    
    Use the -l mq option to qcc to link against this library.
    

## Description:

The mq_open() function opens a message queue referred to by name, and returns a message queue descriptor by which the queue can be referenced in the future.

The message queue manager needs to be running. QNX Neutrino supports two implementations of message queues: a traditional implementation, and an alternate one that uses the mq server and a queue in kernel space. For more information, see the entries for [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) and [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html) in the Utilities Reference, as well as the [POSIX Message Queues: Two Implementations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.technotes/topic/managing_mq_mqueue.html) technote.

The mq_open() function creates an entry for the message queue in the pathname space:

- With the traditional (mqueue) implementation, message queues are created under /dev/mqueue.
- With the alternate (mq) implementation, message queues are created under /dev/mq (or the path specified with the -N option to [mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html)).

The name argument is interpreted as follows:

- If the name argument starts with a slash, the queue is given that name.
- If the name argument doesn't begin with a slash character, the queue is given that name, prepended with the current working directory.

In either case, slash characters other than the leading slash character aren't interpreted, and the specified name, including these slash characters, is used to identify the message queue. In other words, additional slashes don't create a directory structure under /dev/mqueue or /dev/mq.

For example, if your current directory is /tmp:

|name|Entry with mqueue|Entry with mq|
|---|---|---|
|/entry|/dev/mqueue/entry|/dev/mq/entry|
|entry|/dev/mqueue/tmp/entry|/dev/mq/tmp/entry|

If you want to open a queue on another node, you have to use the traditional (mqueue) implementation and specify the name as /net/node/mqueue_location. Here, node is the node name and mqeueue_location is the device entry for the queue under /dev/mqueue (on the remote node). For instance, if you want to open the queue at /dev/mqueue/mylocalqueue on a node named NTO1, you must use the name /net/NTO1/mylocalqueue in calling mq_open().

Note the difference in the path syntax required for QNX SDP 7.0 as compared to earlier releases (i.e., 6.X). In this later release, you must _not_ include /dev/mqueue in the path of the message queue.

If name doesn't exist, mq_open() examines the third and fourth parameters: a mode_t and a pointer to an mq_attr structure.

The only time that a call to mq_open() with O_CREAT set fails is if you open a message queue and later unlink it, but never close it. Like their file counterparts, an unlinked queue that hasn't yet been closed must continue to exist; an attempt to recreate such a message queue fails, and errno is set to ENOENT.

Message queues persist—like files—even after the processes that created them end. A message queue is destroyed when the last process connected to it unlinks from the queue by calling [mq_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_unlink.html "Remove a queue").

## Returns:

A valid message queue descriptor if the queue is successfully created, or -1 ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set).

## Errors:

### `EACCES`

The message queue exists, and you don't have permission to open the queue under the given oflag, or the message queue doesn't exist, and you don't have permission to create one.

### `EEXIST`

You specified the O_CREAT and O_EXCL flags in oflag, and the queue name exists.

### `EINTR`

The operation was interrupted by a signal.

### `EINVAL`

You specified the O_CREAT flag in oflag, and mq_attr wasn't NULL, but some values in the mq_attr structure were invalid.

### `ELOOP`

Too many levels of symbolic links or prefixes.

### `EMFILE`

Too many message queue descriptors or file descriptors are in use by the calling process.

### `ENAMETOOLONG`

The length of name exceeds PATH_MAX.

### `ENFILE`

Too many message queues are open in the system.

### `ENOENT`

You didn't set the O_CREAT flag, and the queue name doesn't exist.

### `ENOSPC`

The message queue server has run out of memory.

### `EPERM`

The process doesn't have the necessary MAC permissions to connect.

### `ENOSYS`

The mq_open() function isn't implemented for the filesystem specified in name, or the message queue manager ([mq](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html) or [mqueue](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html)) isn't running.

## Examples:

```c
#include <stdio.h>
#include <stdlib.h>
#include <mqueue.h>
#include <fcntl.h>
#include <time.h>
#include <errno.h>
#include <string.h>

#define MAX_MSG_SIZE 4096
#define MAX_MSGS     2

int main( void )
{
  mqd_t msg_queue;
  int   ret, i;
  int   msg_num = 0;
  unsigned int prio;
  char  send_msg[MAX_MSG_SIZE];
  char  received_msg[MAX_MSG_SIZE];
  ssize_t received_len;
  struct timespec abs_timeout;
  struct mq_attr attrs;

  /* Open a message queue. We'll restrict the number of messages so that the
     queue fills up quickly. */

  memset(&attrs, 0, sizeof attrs);
  attrs.mq_maxmsg = MAX_MSGS;
  attrs.mq_msgsize = MAX_MSG_SIZE;
  msg_queue = mq_open( "/my_queue", O_RDWR | O_CREAT, S_IRWXU | S_IRWXG, &attrs );
  if (msg_queue == -1) {
     perror ("mq_open()");
     return EXIT_FAILURE;
  }

  printf ("Successfully opened my_queue:\n");

  /* Get the queue's attributes. */

  ret = mq_getattr (msg_queue, &attrs);
  if (ret == -1) {
     perror ("mq_getattr()");
     return EXIT_FAILURE;
  }

  printf ("  Flags: %lx; max messages: %ld; max message size: %ld\n",
     attrs.mq_flags, attrs.mq_maxmsg, attrs.mq_msgsize);
  printf ("  Messages: %ld; send waits: %ld; receive waits: %ld\n\n",
     attrs.mq_curmsgs, attrs.mq_sendwait, attrs.mq_recvwait);

  /* Send enough messages to fill the queue. */

  for (i=1; i <= MAX_MSGS; i++)
  {
    msg_num++;
    sprintf (send_msg, "This is message number %d.", msg_num);
    ret = mq_send (msg_queue, send_msg, sizeof(send_msg), 5);
    if (ret == -1) {
       perror ("mq_send()");
       return EXIT_FAILURE;
    }

    ret = mq_getattr (msg_queue, &attrs);
    if (ret == -1) {
       perror ("mq_getattr()");
       return EXIT_FAILURE;
    }

    printf ("After sending:\n");
    printf ("  Messages: %ld; send waits: %ld; receive waits: %ld\n\n",
            attrs.mq_curmsgs, attrs.mq_sendwait, attrs.mq_recvwait);
  }

  /* Send a message, specifying a time limit. This should time out
     because the queue is full. */

  clock_gettime(CLOCK_REALTIME, &abs_timeout);
  abs_timeout.tv_sec += 1;

  msg_num++;
  sprintf (send_msg, "This is message number %d.", msg_num);
  ret = mq_timedsend (msg_queue, send_msg, sizeof(send_msg), 5, &abs_timeout);
  if (ret == -1) {
     if ((errno == EINTR) || (errno == ETIMEDOUT)) {
        printf ("mq_timedsend() timed out:\n");
     } else {
        perror ("mq_timedsend()");
        return EXIT_FAILURE;
     }
  } else {
    printf ("After sending with a time limit:\n");
  }

  ret = mq_getattr (msg_queue, &attrs);
  if (ret == -1) {
     perror ("mq_getattr()");
     return EXIT_FAILURE;
  }

  printf ("  Messages: %ld; send waits: %ld; receive waits: %ld\n\n",
     attrs.mq_curmsgs, attrs.mq_sendwait, attrs.mq_recvwait);

  /* Receive enough messages to empty the queue. */

  for (i=1; i <= MAX_MSGS; i++)
  {
    received_len = mq_receive (msg_queue, received_msg, MAX_MSG_SIZE, &prio);
    if (received_len == -1) {
       perror ("mq_receive()");
       return EXIT_FAILURE;
    }

    printf ("After receiving:\n");
    printf ("  Length: %ld; priority: %d; msg: \"%s\"\n", received_len, prio, received_msg);

    ret = mq_getattr (msg_queue, &attrs);
    if (ret == -1) {
       perror ("mq_getattr()");
       return EXIT_FAILURE;
    }

    printf ("  Messages: %ld; send waits: %ld; receive waits: %ld\n\n",
       attrs.mq_curmsgs, attrs.mq_sendwait, attrs.mq_recvwait);
  }

  /* Receive a message, specifying a time limit. This should time out
     because the queue is now empty. */

  clock_gettime(CLOCK_REALTIME, &abs_timeout);
  abs_timeout.tv_sec += 1;

  received_len = mq_timedreceive (msg_queue, received_msg, MAX_MSG_SIZE, &prio,
                                  &abs_timeout);
  if (received_len == -1) {
     if ((errno == EINTR) || (errno == ETIMEDOUT)) {
        printf ("mq_timedreceive() timed out:\n");
     } else {
        perror ("mq_timedreceive()");
        return EXIT_FAILURE;
     }
  } else {
    printf ("After receiving, specifying a time limit:\n");
    printf ("  Length: %ld; priority: %d; msg: \"%s\"\n", received_len, prio, received_msg);
  }

  ret = mq_getattr (msg_queue, &attrs);
  if (ret == -1) {
     perror ("mq_getattr()");
     return EXIT_FAILURE;
  }

  printf ("  Messages: %ld; send waits: %ld; receive waits: %ld\n",
     attrs.mq_curmsgs, attrs.mq_sendwait, attrs.mq_recvwait);

  /* Unlink and then close the message queue. */
  ret = mq_unlink ("/my_queue");
  if (ret == -1) {
     perror ("mq_unlink()");
     return EXIT_FAILURE;
  }

  ret = mq_close (msg_queue);
  if (ret == -1) {
     perror ("mq_close()");
     return EXIT_FAILURE;
  }

  return EXIT_SUCCESS;
}
```

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

[mq_close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_close.html "Close a message queue")

[mq_getattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_getattr.html "Get a message queue's attributes")

[mq_notify()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_notify.html "Ask to be notified when there's a message in the queue")

[mq_receive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_receive.html "Receive a message from a queue")

[mq_send()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_send.html "Send a message to a queue")

[mq_setattr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_setattr.html "Set a queue's attributes")

[mq_timedreceive(), mq_timedreceive_monotonic()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_timedreceive.html "Receive a message from a message queue")

[mq_timedsend(), mq_timedsend_monotonic()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_timedsend.html "Send a message to a message queue")

[mq_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mq_unlink.html "Remove a queue")

[mq (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mq.html "mq (Utilities Reference)")

[mqueue (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/m/mqueue.html "mqueue (Utilities Reference)")
