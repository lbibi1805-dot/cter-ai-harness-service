---
title: "Sleepon locks"
category: "Synchronization-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, synchronization, mutex, semaphore]
---

# Sleepon locks

Sleepon locks are very similar to condvars, with a few subtle differences.

Like condvars, sleepon locks ([pthread_sleepon_lock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_sleepon_lock.html)) can be used to block until a condition becomes true (like a memory location changing value). But unlike condvars, which must be allocated for each condition to be checked, sleepon locks multiplex their functionality over a single mutex and dynamically allocated condvar, regardless of the number of conditions being checked. The maximum number of condvars ends up being equal to the maximum number of blocked threads. These locks are patterned after the sleepon locks commonly used within the UNIX kernel.

### Related concepts  

[Sleepon locks (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_sleepon.html "Sleepon locks (Getting Started with QNX Neutrino)")

[Sleepons versus condvars (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_Sleepons_vs_condvars.html "Sleepons versus condvars (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_sleepon_broadcast()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_sleepon_broadcast.html "pthread_sleepon_broadcast()")

[pthread_sleepon_lock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_sleepon_lock.html "pthread_sleepon_lock()")

[pthread_sleepon_signal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_sleepon_signal.html "pthread_sleepon_signal()")

[pthread_sleepon_timedwait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_sleepon_timedwait.html "pthread_sleepon_timedwait()")

[pthread_sleepon_unlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_sleepon_unlock.html "pthread_sleepon_unlock()")

[pthread_sleepon_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_sleepon_wait.html "pthread_sleepon_wait()")
