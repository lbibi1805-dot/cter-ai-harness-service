QNX Tool SuiteIntegrated Development Environment User's GuideDeveloperSetup

You can launch a unit test program on the target and the IDE will display the results of individual tests in a dedicated view as the program runs.

To run a test program:

1. In the Launch Configuration dropdown, select the project containing the relevant test program.
2. In the Launch Mode dropdown, select Run.
3. In the Launch Target dropdown, select the target for running the test program.
4. Click the Edit button (![Icon: Edit button](https://www.qnx.com/developers/docs/8.0/com.qnx.doc.ide.userguide/images/icons/edit.png)) on the right of the Launch Configuration dropdown.
5. In the [Main tab](https://www.qnx.com/developers/docs/8.0/com.qnx.doc.ide.userguide/topic/launch_configuration_properties.html#qnxlaunchconfigprops__main) of the configuration editor window, enter the path of the test program in the C/C++ Application field.
6. In the [Arguments tab](https://www.qnx.com/developers/docs/8.0/com.qnx.doc.ide.userguide/topic/launch_configuration_properties.html#qnxlaunchconfigprops__arguments), check the Test Runner checkbox to enable the test framework selector.
7. In the Tests Runner dropdown, select the framework on which your test program is based.
    
    The IDE can't auto-detect the framework you're using, so you must manually specify one.
    
8. In the [Upload tab](https://www.qnx.com/developers/docs/8.0/com.qnx.doc.ide.userguide/topic/launch_configuration_properties.html#qnxlaunchconfigprops__upload), check the libgtest.so and libregex.so checkboxes to upload these libraries to the target.
9. Click OK to save the configuration changes and close the window.
10. In the launch bar, click the Run button (![Icon: Run button](https://www.qnx.com/developers/docs/8.0/com.qnx.doc.ide.userguide/images/icons/launch.png)).
    
    The IDE starts running the unit test program on the target. If necessary, the IDE builds the program before copying it to the target.
    

The Console view displays the raw output of the program while the C/C++ Unit view visually presents the test results (based on the IDE's parsing of those results):

  
![Screenshot of C/C++ Unit view, with the BasicTest test case entry expanded to show six individual tests, and an error message caused by a test failure displayed at the bottom](https://www.qnx.com/developers/docs/8.0/com.qnx.doc.ide.userguide/images/c_cpp_unit.png)  

The IDE opens this latter view whenever it launches a test program; you can open the view manually by selecting Window > Show View > Other > C/C++ > C/C++ Unit. At the top, the IDE illustrates testing progress (in a progress bar) and lists the numbers of completed tests (runs), errors, and test failures. In the area below, it lists the names and total running times of the program's test cases. The icon next to each test case name contains a green box with a checkmark if all tests in that test case passed or a blue box with an X if any test failed.

You can expand a test case entry to see the results of individual tests. When you click a specific test, the bottom area shows any messages output by the program while that test ran. There are also buttons on the right for filtering error, warning, and information messages.