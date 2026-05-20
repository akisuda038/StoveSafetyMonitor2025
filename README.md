# StoveSafetyMonitor2025
Context-aware cooktop hazard detection

4 subsystems from Section IV:

IR Sensing — simulated 10×10 thermopile array with spatial heat blending across burners
Thermal Feature Extraction — temperature, dT/dt direction, heating trajectory sparklines
Contextual Inference Engine — per-burner hazard confidence scoring combining temp + pan presence + inactivity time
Intervention subsystem — progressive alert log (Monitoring → Warning → Danger)
