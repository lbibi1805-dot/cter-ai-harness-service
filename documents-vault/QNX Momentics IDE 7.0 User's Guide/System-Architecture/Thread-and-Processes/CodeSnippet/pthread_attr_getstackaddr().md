---
title: "pthread_attr_getstackaddr()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_attr_getstackaddr()
_Get the thread stack address attribute_

## Synopsis:

```c
#include <pthread.h>

int pthread_attr_getstackaddr(
                    const pthread_attr_t* attr,
                    void** stackaddr );
```

## Arguments:

**attr** —

A pointer to the pthread_attr_t structure that defines the attributes to use when creating new threads. For more information, see [pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object").

**stackaddr** —

A pointer to a location where the function can store the address of the thread stack.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_attr_getstackaddr() function gets the thread stack address attribute from the thread attribute object attr and returns it in stackaddr.

For more information about the thread stack, see [pthread_attr_setstackaddr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstackaddr.html "Set the thread stack address attribute").

## Returns:

### `EOK`

Success.

## Classification:

[Standard Unix; removed from POSIX.1-2008](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

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

[pthread_attr_getstack()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstack.html "Get the thread-creation stack attributes")

[pthread_attr_setstack()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstack.html "Set the thread-creation stack attributes")

[pthread_attr_setstackaddr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstackaddr.html "Set the thread stack address attribute")

[pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object")

[pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html "Create a thread")
