---
title: "pthread_attr_setinheritsched()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_attr_setinheritsched()
_Set the thread's inherit-scheduling attribute_

## Synopsis:

```c
#include <pthread.h>

int pthread_attr_setinheritsched(
                    pthread_attr_t * attr,
                    int inheritsched );
```

## Arguments:

**attr** —

A pointer to the pthread_attr_t structure that defines the attributes to use when creating new threads. For more information, see [pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object").

**inheritsched** —

The new value for the thread's inherit-scheduling attribute:

- PTHREAD_INHERIT_SCHED — the thread inherits the scheduling policy of the parent thread.
- PTHREAD_EXPLICIT_SCHED — use the scheduling policy specified in attr for the thread.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_attr_setinheritsched() function sets the thread inherit scheduling attribute in the attribute object attr to inheritsched.

The default value of the thread inherit scheduling attribute is PTHREAD_INHERIT_SCHED.

## Returns:

### `EOK`

Success.

### `EINVAL`

Invalid thread-inherit scheduling attribute inheritsched.

## Classification:

[POSIX 1003.1 TPS](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Processes and Threads (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs.html "Processes and Threads (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_attr_getinheritsched()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getinheritsched.html "Get a thread's inherit-scheduling attribute")

[pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object")

[pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html "Create a thread")
