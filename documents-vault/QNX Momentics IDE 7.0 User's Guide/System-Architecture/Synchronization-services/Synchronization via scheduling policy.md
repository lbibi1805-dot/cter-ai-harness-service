---
title: "Synchronization via scheduling policy"
category: "Synchronization-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, synchronization, mutex, semaphore]
---

# Synchronization via scheduling policy

By selecting the POSIX FIFO scheduling policy, we can guarantee that no two threads of the same priority execute the critical section concurrently on a non-SMP system.

The FIFO scheduling policy dictates that all FIFO-scheduled threads in the system at the same priority will run, when scheduled, until they voluntarily release the processor to another thread.

This “release” can also occur when the thread blocks as part of requesting the service of another process, or when a signal occurs. _The critical region must therefore be carefully coded and documented so that later maintenance of the code doesn't violate this condition._

In addition, higher-priority threads in that (or any other) process could still preempt these FIFO-scheduled threads. So, all the threads that could “collide” within the critical section must be FIFO-scheduled at the _same_ priority. Having enforced this condition, the threads can then casually access this shared memory without having to first make explicit synchronization calls.

This exclusive-access relationship doesn't apply in multiprocessor systems, since each CPU could run a thread simultaneously through the region that would otherwise be serially scheduled on a single-processor machine.

### Related concepts  

[FIFO scheduling](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_FIFO_scheduling.html "FIFO scheduling")

[Multicore Processing](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/smp.html "Multicore Processing")

[Multicore Processing (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/multicore.html "Multicore Processing (QNX Neutrino Programmer's Guide)")

[Multiple CPU (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_Multiple_CPUs.html "Multiple CPU (Getting Started with QNX Neutrino)")

[Things to watch out for when using SMP (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_smpbeware.html "Things to watch out for when using SMP (Getting Started with QNX Neutrino)")

[SMP support (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s3_qnx2nto_SMP_support.html "SMP support (Getting Started with QNX Neutrino)")
