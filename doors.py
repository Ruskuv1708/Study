import cv2
import time

class DoorAgent:
    def __init__(self, camera_index=0, min_area=10000, close_delay=0.5):
        self.cap = cv2.VideoCapture(camera_index)
        self.min_area = min_area
        self.close_delay = close_delay
        
        self.door_status = "CLOSED"
        self.background_model = None
        self.last_motion_time = 0
        self.debug_reason = "No movement" # Stores the 'Why'
        
        print("[INFO] Warming up camera... please step out of frame.")
        time.sleep(2.0)

    def process_frame(self, frame):
        # 1. Image Processing
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        # 2. Reset background if needed
        if self.background_model is None:
            self.background_model = gray
            return False

        # 3. Detect changes
        delta = cv2.absdiff(self.background_model, gray)
        thresh = cv2.threshold(delta, 30, 255, cv2.THRESH_BINARY)[1]
        thresh = cv2.dilate(thresh, None, iterations=2)

        # 4. Find Contours
        contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        motion_found = False

        for contour in contours:
            # Filter out small movements
            if cv2.contourArea(contour) < self.min_area:
                continue

            motion_found = True
            
            # Draw green box
            (x, y, w, h) = cv2.boundingRect(contour)
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

        return motion_found

    def update_logic(self, is_moving):
        current_time = time.time()

        # --- LOGIC TO HANDLE STATES ---
        if is_moving:
            self.last_motion_time = current_time
            if self.door_status == "CLOSED":
                self.door_status = "OPEN"
                print(">>> ACTION: Opening Door")
            
            # REASON: Why is it open?
            self.debug_reason = "Holding Open: Motion Detected"

        else:
            # Movement stopped, check timer
            time_since_motion = current_time - self.last_motion_time
            time_left = self.close_delay - time_since_motion

            if self.door_status == "OPEN":
                if time_since_motion > self.close_delay:
                    self.door_status = "CLOSED"
                    print(">>> ACTION: Closing Door")
                    self.debug_reason = "Door is Closed"
                else:
                    # REASON: Why is it NOT closing?
                    self.debug_reason = f"Holding Open: Timer ({time_left:.1f}s)"
            else:
                self.debug_reason = "Door is Closed (Idle)"

    def run(self):
        print("[INFO] Running. Press 'q' to quit. Press 'r' to reset background.")
        
        try:
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    break

                # 1. Detect
                is_moving = self.process_frame(frame)
                
                # 2. Decide
                self.update_logic(is_moving)

                # 3. Display Info on Screen
                # Status Color: Green for Open, Red for Closed
                color = (0, 255, 0) if self.door_status == "OPEN" else (0, 0, 255)
                
                # Line 1: Main Status
                cv2.putText(frame, f"STATUS: {self.door_status}", (10, 40), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, color, 3)
                
                # Line 2: The "Why" (Yellow text)
                cv2.putText(frame, f"INFO: {self.debug_reason}", (10, 80), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

                cv2.imshow("Door Agent Debugger", frame)

                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('r'):
                    self.background_model = None
                    print("[INFO] Background Reset")

        finally:
            self.cap.release()
            cv2.destroyAllWindows()

if __name__ == "__main__":
    # Min Area 10000 = Only big movements
    # Close Delay 0.5 = Closes very fast
    agent = DoorAgent(min_area=10000, close_delay=0.5)
    agent.run()