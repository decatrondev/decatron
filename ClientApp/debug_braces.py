
import sys

def check_braces(file_path):
    balance = 0
    try:
        with open(file_path, 'r') as f:
            lines = f.readlines()
            
        for i, line in enumerate(lines):
            open_count = line.count('{')
            close_count = line.count('}')
            balance += open_count - close_count
            
            # Si el balance baja de 0 (excepto quizás al final si es namespace global, pero aquí empieza con namespace)
            # En C#, namespace abre {, así que balance debería ser >= 0 hasta el final.
            if balance < 0:
                print(f"Error potential at line {i+1}: Balance went negative ({balance}). Line content: {line.strip()}")
                return

        print(f"Final balance: {balance}")
        
    except Exception as e:
        print(f"Error reading file: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        check_braces(sys.argv[1])
    else:
        print("Usage: python debug_braces.py <file>")
