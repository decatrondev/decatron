
import sys

def check_braces(file_path):
    balance = 0
    class_started = False
    try:
        with open(file_path, 'r') as f:
            lines = f.readlines()
            
        for i, line in enumerate(lines):
            line_num = i + 1
            if "class TimerEventService" in line:
                class_started = True
                
            open_count = line.count('{')
            close_count = line.count('}')
            
            prev_balance = balance
            balance += open_count - close_count
            
            if class_started:
                # Si estamos dentro de la clase (balance debería ser >= 2, asumiendo namespace=1, class=2)
                # Si baja a 1, cerramos la clase.
                if balance == 1 and prev_balance >= 2:
                    print(f"Class potentially closed at line {line_num}: {line.strip()}")
            
            if balance < 0:
                print(f"Error negative balance at {line_num}")
                return

        print(f"Final balance: {balance}")
        
    except Exception as e:
        print(f"Error reading file: {e}")

if __name__ == "__main__":
    check_braces(sys.argv[1])
