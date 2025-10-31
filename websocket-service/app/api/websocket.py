"""
WebSocket API Routes

Provides WebSocket endpoint for real-time task status updates.
"""

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.connection_manager import connection_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates
    
    Protocol:
    1. Client connects
    2. Client sends: {"type": "subscribe", "task_id": "uuid"}
    3. Server sends: {"type": "subscribed", "task_id": "uuid", "message": "..."}
    4. Server pushes: {"type": "status_update", "task_id": "uuid", "data": {...}}
    5. Client can unsubscribe: {"type": "unsubscribe", "task_id": "uuid"}
    
    Example client code (JavaScript):
    ```javascript
    const ws = new WebSocket('ws://localhost:8001/ws');
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        task_id: 'your-task-id'
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);
      
      if (data.type === 'status_update') {
        // Update UI with data.data
      }
    };
    ```
    """
    await connection_manager.connect(websocket)
    
    try:
        while True:
            # Receive message from client
            message = await websocket.receive_text()
            
            # Handle message (subscribe/unsubscribe)
            await connection_manager.handle_message(websocket, message)
    
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
        logger.info("Client disconnected normally")
    
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        connection_manager.disconnect(websocket)


@router.get("/ws/stats")
async def get_websocket_stats():
    """
    Get WebSocket connection statistics
    
    Returns:
        Statistics about active connections and subscriptions
    """
    return connection_manager.get_stats()

