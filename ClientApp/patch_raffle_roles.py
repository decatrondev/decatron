
import os

file_path = "../Decatron.Services/RaffleService.cs"
snippet_path = "raffle_logic_fix.txt"

try:
    with open(file_path, "r") as f:
        content = f.read()

    with open(snippet_path, "r") as f:
        snippet = f.read()

    # Find insertion point: "var logs = await _context.TimerEventLogs..."
    # We want to insert AFTER fetching logs, but BEFORE iterating them.
    
    search_str = '.ToListAsync();'
    # We need to find the specific ToListAsync inside ImportParticipantsFromSessionAsync
    # It's the one under "// 3. Obtener Logs de la Sesión"
    
    start_marker = '// 3. Obtener Logs de la Sesión'
    start_index = content.find(start_marker)
    
    if start_index == -1:
        print("Error: Could not find step 3 marker.")
        exit(1)
        
    list_async_index = content.find(search_str, start_index)
    if list_async_index == -1:
        print("Error: Could not find ToListAsync after marker.")
        exit(1)
        
    insertion_point = list_async_index + len(search_str)
    
    # We also need to replace the start of step 4 ("// 4. Agrupar y Filtrar")
    # because our snippet REPLACES the beginning of the loop logic to inject the filter.
    
    step_4_marker = '// 4. Agrupar y Filtrar'
    step_4_index = content.find(step_4_marker, insertion_point)
    
    if step_4_index == -1:
        print("Error: Could not find step 4 marker.")
        exit(1)
        
    # Find the loop start "foreach (var log in logs)"
    loop_start = content.find("foreach (var log in logs)", step_4_index)
    if loop_start == -1:
        print("Error: Could not find loop start.")
        exit(1)
        
    # Find the first line inside the loop to stitch correctly
    # "string user = log.Username.ToLower();"
    user_var_index = content.find("string user = log.Username.ToLower();", loop_start)
    
    # We want to replace from Step 4 Marker up to (and including) "string user = ...;"
    # Actually, our snippet ends with "string user = log.Username.ToLower();" + logic + "string type = ..."
    
    # Let's be surgical.
    # 1. Insert the exclusions logic BEFORE the loop.
    # 2. Inside the loop, insert the check.
    
    # Strategy B: Replace the whole block from "// 4. Agrupar y Filtrar" down to "string type = log.EventType.ToLower();"
    
    end_replace_marker = 'string type = log.EventType.ToLower();'
    end_replace_index = content.find(end_replace_marker, loop_start)
    
    if end_replace_index == -1:
        print("Error: Could not find end replace marker.")
        exit(1)
        
    new_content = content[:step_4_index] + snippet + "\n                " + content[end_replace_index:]
    
    with open(file_path, "w") as f:
        f.write(new_content)
        
    print("Successfully injected role validation logic.")

except Exception as e:
    print(f"Error: {e}")
    exit(1)
