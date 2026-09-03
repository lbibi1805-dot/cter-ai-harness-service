---
title: "pthread_attr_setstacksize()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_attr_setstacksize()
_Set the thread stack-size attribute_

## Synopsis:

```c
#include <pthread.h>

int pthread_attr_setstacksize( pthread_attr_t * attr,
                               size_t stacksize );
```

## Arguments:

**attr** —

A pointer to the pthread_attr_t structure that defines the attributes to use when creating new threads. For more information, see [pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object").

**stacksize** —

The size of the stack you want to use in new threads. The minimum value of the thread stack-size attribute is PTHREAD_STACK_MIN.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_attr_setstacksize() function sets the thread stack size attribute in the thread attribute object attr to stacksize.

The system uses some of the provided stack for objects such as thread local storage and an initial stack frame, so less than the entire buffer is available to the thread.

## Returns:

### `EOK`

Success.

### `EINVAL`

The value of stacksize is non-zero and less than PTHREAD_STACK_MIN.

## Classification:

[POSIX 1003.1 TSS](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

## Caveats:

The QNX Neutrino interpretation of PTHREAD_STACK_MIN is enough memory to run a thread that does nothing:

void *nothingthread( void *ignored )
{
    return NULL;
}

### Related concepts  

[Processes and Threads (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs.html "Processes and Threads (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_attr_getstacksize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstacksize.html "Get the thread stack-size attribute")

[pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object")

[pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html "Create a thread")
