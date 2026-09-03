---
title: "Barriers"
category: "Synchronization-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, synchronization, mutex, semaphore]
---

# Barriers
A barrier is a synchronization mechanism that lets you “corral” several cooperating threads (e.g., in a matrix computation), forcing them to wait at a specific point until all have finished before any one thread can continue.

Unlike the [pthread_join()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_join.html) function, where you'd wait for the threads to terminate, in the case of a barrier you're waiting for the threads to _rendezvous_ at a certain point. When the specified number of threads arrive at the barrier, we unblock _all of them_ so they can continue to run.

You first create a barrier with [pthread_barrier_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrier_init.html):

#include <pthread.h>

int
pthread_barrier_init (pthread_barrier_t *barrier,
                      const pthread_barrierattr_t *attr,
                      unsigned int count);

This creates a barrier object at the passed address (a pointer to the barrier object is in barrier), with the attributes as specified by attr. The count member holds the number of threads that must call [pthread_barrier_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrier_wait.html).

Once the barrier is created, each thread will call pthread_barrier_wait() to indicate that it has completed:

#include <pthread.h>

int pthread_barrier_wait (pthread_barrier_t *barrier);

When a thread calls pthread_barrier_wait(), it blocks until the number of threads specified initially in the pthread_barrier_init() function have called pthread_barrier_wait() (and blocked also). When the correct number of threads have called pthread_barrier_wait(), all those threads will unblock _at the same time_.

Here's an example:

/*
 *  barrier1.c
 */

#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <time.h>
#include <pthread.h>
#include <sys/neutrino.h>

pthread_barrier_t   barrier; // barrier synchronization object

void *
thread1 (void *not_used)
{
    time_t  now;

    time (&now);
    printf ("thread1 starting at %s", ctime (&now));

    // do the computation
    // let's just do a sleep here...
    sleep (20);
    pthread_barrier_wait (&barrier);
    // after this point, all three threads have completed.
    time (&now);
    printf ("barrier in thread1() done at %s", ctime (&now));
}

void *
thread2 (void *not_used)
{
    time_t  now;

    time (&now);
    printf ("thread2 starting at %s", ctime (&now));

    // do the computation
    // let's just do a sleep here...
    sleep (40);
    pthread_barrier_wait (&barrier);
    // after this point, all three threads have completed.
    time (&now);
    printf ("barrier in thread2() done at %s", ctime (&now));
}

int main () // ignore arguments
{
    time_t  now;

    // create a barrier object with a count of 3
    pthread_barrier_init (&barrier, NULL, 3);

    // start up two threads, thread1 and thread2
    pthread_create (NULL, NULL, thread1, NULL);
    pthread_create (NULL, NULL, thread2, NULL);

    // at this point, thread1 and thread2 are running

    // now wait for completion
    time (&now);
    printf ("main() waiting for barrier at %s", ctime (&now));
    pthread_barrier_wait (&barrier);

    // after this point, all three threads have completed.
    time (&now);
    printf ("barrier in main() done at %s", ctime (&now));
    pthread_exit( NULL );
    return (EXIT_SUCCESS);
}

The main thread created the barrier object and initialized it with a count of the total number of threads that must be synchronized to the barrier before the threads may carry on. In the example above, we used a count of 3: one for the main() thread, one for thread1(), and one for thread2().

Then we start thread1() and thread2(). To simplify this example, we have the threads sleep to cause a delay, as if computations were occurring. To synchronize, the main thread simply blocks itself on the barrier, knowing that the barrier will unblock only after the two worker threads have joined it as well.

In this release, the following barrier functions are included:

|Function|Description|
|---|---|
|[pthread_barrierattr_getpshared()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrierattr_getpshared.html)|Get the value of a barrier's process-shared attribute|
|[pthread_barrierattr_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrierattr_destroy.html)|Destroy a barrier's attributes object|
|[pthread_barrierattr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrierattr_init.html)|Initialize a barrier's attributes object|
|[pthread_barrierattr_setpshared()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrierattr_setpshared.html)|Set the value of a barrier's process-shared attribute|
|[pthread_barrier_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrier_destroy.html)|Destroy a barrier|
|[pthread_barrier_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrier_init.html)|Initialize a barrier|
|[pthread_barrier_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrier_wait.html)|Synchronize participating threads at the barrier|

### Related concepts  

[Safely sharing mutexes, barriers, and reader/writer locks between processes](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sharing_sync.html "You can share most synchronization objects between processes, but security can be a concern.")

[Using a barrier (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_barriers.html "Using a barrier (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_barrierattr_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrierattr_destroy.html "pthread_barrierattr_destroy()")

[pthread_barrierattr_getpshared()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrierattr_getpshared.html "pthread_barrierattr_getpshared()")

[pthread_barrierattr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrierattr_init.html "pthread_barrierattr_init()")

[pthread_barrierattr_setpshared()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrierattr_setpshared.html "pthread_barrierattr_setpshared()")

[pthread_barrier_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrier_destroy.html "pthread_barrier_destroy()")

[pthread_barrier_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrier_init.html "pthread_barrier_init()")

[pthread_barrier_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_barrier_wait.html "pthread_barrier_wait()")
