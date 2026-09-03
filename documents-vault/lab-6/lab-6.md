### Task 1A: Native Message Passing Setup and Configuration

**Task Objective Summary** The objective of this task is to configure a QNX Native IPC client-server architecture using named channels. The task involves modifying the provided boilerplate code to establish a unique attach point to prevent network collisions, configuring the server to remain active after client disconnection, and preparing the client to utilize the QNET network protocol for inter-node communication.

**SourceCode (*.c)** Please refer to the attached `Lab6-Task-1a-server.c` and `Lab6-Task1a-Client.c` files in the submission package for the complete source code.

**ExpectedOutput** The code should compile successfully into separate executable binaries within the QNX Momentics IDE. The server code should be configured to ignore termination requests. The client code should be pointed to the server's QNET network path rather than the local node path.

**Analysis** Based on the code inspection and modifications, the baseline architecture for network-capable IPC is established:

- **Unique Attach Point:** The default `ATTACH_POINT` was modified to `bach_s4029308_chan`. This ensures an exclusive communication channel on a shared lab network, avoiding unintentional connections to servers hosted by other students.
    
- **QNET Configuration:** The `LOCAL_ATTACH_POINT` was bypassed in favor of the `QNET_ATTACH_POINT`. The path was updated to `/net/ServerNode/dev/name/local/bach_s4029308_chan`, explicitly directing the client's `name_open()` function to resolve the server's hostname over the network rather than looking within its own local file system.
    
- **Server Resilience:** The `Stay_alive` variable within the server's main loop was modified from `0` to `1`. This critical change dictates that when the server receives a `_PULSE_CODE_DISCONNECT` pulse from a terminating client, it rejects the detachment request and remains in the `MsgReceive()` blocking state, ready to accept subsequent clients.
    

**Screenshot** _(Note: As Task 1A is primarily code modification and compilation within the IDE, screenshots of the execution are provided in Task 1B)._

### Task 1B: QNX Native IPC over QNET (Multi-Node Execution)

**Task Objective Summary** The objective of this task is to deploy and execute the compiled client and server binaries on separate QNX nodes over a network. The application aims to demonstrate successful native message passing and node resolution via QNET by running two distinct clients (with unique IDs 101 and 102) connecting to a single, continuously running server node.

**SourceCode (*.c)** Please refer to the attached `Lab6-Task-1a-server.c` and `Lab6-Task1a-Client.c` files in the submission package for the complete source code.

**ExpectedOutput** The server should establish the attach point and listen for connections. Client 1 (ID: 101) and Client 2 (ID: 102) should successfully resolve the server's path via the `/net` directory. Each client should sequentially send 5 data packets, receive 5 acknowledgment replies from the server, and terminate. The server console should log all incoming packets, explicitly show the rejection of the disconnect pulse from Client 1, and process Client 2's packets immediately after.

**Analysis** Based on the execution across multiple SSH sessions, the Native IPC system operates correctly over the network:

- **QNET Network Resolution:** The execution validates the necessity of mounting the QNET protocol (`mount -T io-pkt lsm-qnet.so`). Once the protocol was active, the `/net` directory became populated, allowing the client to successfully establish a connection to `/net/ServerNode/...` without returning a "could not connect to server" error.
    
- **Synchronous Message Passing:** The console logs demonstrate the synchronous nature of QNX Native IPC. The client program correctly blocks upon invoking `MsgSend()` and only proceeds to the next iteration of its loop after the server processes the data and invokes `MsgReply()`.
    
- **Sequential Multi-Client Handling:** As demonstrated in the server execution log, when Client 101 finishes sending its 5 packets, it sends a disconnect pulse (Code: -33). The server logs state: `Server received Detach pulse from ClientID:101 but rejected it ...`. Because the server loop does not break, it seamlessly accepts the subsequent connection and 5 data packets from Client 102.
    

**Screenshot**
![[Pasted image 20260826143704.png]]
 **Figure 1:** Task 1B Execution demonstrating ClientNode1 (ID: 101) successfully connecting to the ServerNode via QNET, sending 5 packets, and receiving replies.

![[Pasted image 20260826144536.png]]
_(Bạn chèn ảnh 2 vào đây)_ **Figure 2:** Task 1B Execution demonstrating ClientNode2 (ID: 102) successfully connecting to the ServerNode via QNET, sending 5 packets, and receiving replies.

![[Pasted image 20260826144739.png]]
_(Bạn chèn ảnh 3 vào đây)_ **Figure 3:** Task 1B Execution demonstrating the Server console log. The server receives data from ID: 101, rejects the detach pulse (-33), and subsequently receives data from ID: 102.

### Task 2A: Local QNX Message Passing (Same Node)

**Task Objective Summary** The objective of this task is to implement a highly efficient local Inter-Process Communication (IPC) architecture for client and server threads running on the same QNX node. Instead of utilizing network-based naming services (`name_attach`), the application establishes a direct communication channel using `ChannelCreate()` on the server and `ConnectAttach()` on the client. This requires the client to explicitly know the server's dynamically allocated Process ID (PID) and Channel ID (CHID).

**SourceCode (*.c)** Please refer to the attached `Lab6-Task-2a-Server.c` and `Lab6-Task-2a-client.c` files in the submission package for the complete source code.

**ExpectedOutput** The server process should start and output its dynamic PID and CHID to the console. The client code, once manually updated with these specific IDs and recompiled, should successfully attach to the server process via the local node (`ND_LOCAL_NODE`). The client should send 5 sequential messages, receive acknowledgments, and detach cleanly, while the server remains active to accept future connections.

**Analysis** Based on the execution results, the local message passing system was successfully established:

- **Dynamic ID Resolution:** The server generated a dynamic PID (e.g., `921626`) and Channel ID (`2`). The client successfully routed its messages to these specific local coordinates, validating the mechanics of `ConnectAttach()`.
    
- **Local Node Communication:** Unlike the previous task which routed data through the `/net` directory using QNET, this execution verified direct kernel-level message passing within the same system architecture, bypassing external network protocol overhead.
    
- **Server Resilience:** Similar to Task 1, the server's control loop was modified (`Stay_alive = 1`). Upon receiving the `_PULSE_CODE_DISCONNECT` signal from the terminating client, the server successfully rejected the detach pulse and maintained its listening state.
    

**Screenshot**

![[Pasted image 20260826150452.png]]
 **Figure 1:** Task 2A Execution demonstrating the Client successfully connecting to the Server using the explicitly defined PID (921626) and Channel ID (2).

 ![[Pasted image 20260826150507.png]]
 **Figure 2:** Task 2A Execution demonstrating the Server console generating its IDs, receiving the 5 data packets from ClientID: 500, and rejecting the termination pulse.

### Task 2B: Automated Local IPC via File I/O

**Task Objective Summary** The objective of this task is to fully automate the local message passing system implemented in Task 2A. Instead of hardcoding the dynamically generated Process ID (PID) and Channel ID (CHID), the server is required to write these parameters to a known file location (`/tmp/myServer.info`). Consequently, the client application must programmatically retrieve these values from the file, ensuring seamless connection establishment even when the server process is restarted and assigned a new PID by the QNX operating system.

**Source Code (*.c)** Please refer to the attached `Lab6-Task-2b-Server.c` and `Lab6-Task-2b-Client.c` files for the implementation utilizing standard C file handling functions (`fopen`, `fprintf`, `fscanf`).

**Analysis** The automated IPC architecture was successfully verified through a two-step execution process:

- **Automated Data Retrieval:** Upon the first execution, the server dynamically allocated PID `1228826` and CHID `2`, successfully writing them to `/tmp/myServer.info`. The client process automatically parsed this file, extracted the correct IDs without manual intervention, and completed the 5-message transaction cycle.
    
- **Dynamic File Updating:** To prove the dynamic nature of the file handling, the server was terminated and re-invoked. The server generated a completely new PID (`1277978`). Running the `cat /tmp/myServer.info` command in the client's terminal verified that the file was successfully overwritten with the new PID, fulfilling the task requirement of demonstrating file state changes across server invocations.
    

**Screenshots**

![[Pasted image 20260826151634.png]]
**Figure 3:** Task 2B Execution (Part 1) demonstrating the Server automatically writing its PID (1228826) to the `.info` file and the Client auto-retrieving it to establish a successful connection.

![[Pasted image 20260826151621.png]]
 **Figure 4:** Task 2B Execution (Part 2) utilizing the `cat` command to demonstrate that the `/tmp/myServer.info` file content dynamically updates to the new PID (1277978) upon restarting the server process.

### Task 2C: Integrated Sensor-Driven Traffic Lights via Local IPC

**Task Objective Summary** The objective of this final integration task is to replace the Message Queue (POSIX `mqueue`) implementation from a previous Traffic Light state machine exercise with the QNX Local Inter-Process Communication (IPC) architecture developed in Tasks 2A and 2B. The system comprises a Server process running the core state machine and a dedicated listening thread for sensor data, and a Client process acting as a keyboard-driven sensor emulator.

**Source Code (*.c)** Please refer to the attached `Lab6-Task-2c-Server.c` and `Lab6-Task-2c-Client.c` files for the full implementation.

**Analysis** The integration was successfully executed and validated through the following observations:

- **Architectural Conversion:** The previous `mq_receive()` blocking calls in the server were completely replaced by QNX `MsgReceive()`. The client successfully transmitted character data (e.g., 'n' and 'e') directly to the server's core kernel channel utilizing `MsgSend()`.
    
- **Thread Safety:** A `pthread_mutex_t` was introduced to protect the `shared_sensor_data` structure. This ensured that the `message_listener_thread` (which asynchronously writes the sensor input) and the `SingleStep_TrafficLight_SM` function (which reads the sensor state in the main thread loop) did not encounter race conditions.
    
- **Functional Verification:** The automated PID retrieval mechanism functioned perfectly. When simulating traffic, inputting 'n' successfully unblocked the EWG-NSR (State 2) loop, smoothly transitioning the machine to EWY-NSR (State 3). Similarly, the 'e' input successfully triggered the EWR-NSG (State 5) transition, proving the integrity of the IPC-driven sensor simulation.
    

**Screenshot**
![[Pasted image 20260826153054.png]]
**Figure 5:** Task 2C Execution demonstrating the Client successfully connecting via dynamically retrieved PID (1589276) and sending 'n' and 'e' sensor signals via QNX IPC, dynamically driving the Server's state machine transitions.