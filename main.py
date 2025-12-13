import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from pattern_detection import PatternDetector 

# Initialize Flask
app = Flask(__name__)
CORS(app) # Allow React app to talk to this backend

# Initialize Firebase
# Looks for the file locally first, then environment variable
cred = None
if os.path.exists('firebase-service-account.json'):
    print("Loading credentials from local file...")
    cred = credentials.Certificate('firebase-service-account.json')
else:
    # Logic for deployment (Render/Heroku)
    print("Looking for FIREBASE_CREDENTIALS env var...")
    json_config = os.environ.get('FIREBASE_CREDENTIALS')
    if json_config:
        cred_dict = json.loads(json_config)
        cred = credentials.Certificate(cred_dict)

if cred:
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase initialized successfully.")
else:
    print("WARNING: Firebase credentials not found. Database features will fail.")

# --- ROUTES ---

@app.route('/', methods=['GET'])
def root():
    """Root route to easily check if server is up"""
    return jsonify({
        "status": "online",
        "message": "Backend is running! Use /analyze-patterns endpoint."
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "pattern-engine"}), 200

@app.route('/analyze-patterns', methods=['POST'])
def analyze_patterns():
    try:
        data = request.json
        user_id = data.get('userId')
        month_id = data.get('monthId') # e.g., "2026-01"
        
        print(f"Analyzing for User: {user_id}, Month: {month_id}")

        if not user_id or not month_id:
            return jsonify({"error": "Missing userId or monthId"}), 400

        # 1. Fetch Data from Firestore
        # Note: The collection path must match your React App EXACTLY
        # structure: artifacts -> {appId} -> users -> {userId} -> monthly_data -> {monthId}
        
        # We need the app ID. For local test we assume 'default-app-id' or pass it in.
        app_id = data.get('appId', 'default-app-id')
        
        doc_path = f'artifacts/{app_id}/users/{user_id}/monthly_data/{month_id}'
        print(f"Fetching document: {doc_path}")
        
        doc_ref = db.document(doc_path)
        doc = doc_ref.get()
        
        if not doc.exists:
            print("Document not found in Firestore.")
            return jsonify({
                "insights": [], 
                "summary": "No data found for this month in the database."
            }), 200
            
        user_data = doc.to_dict()
        daily_logs = user_data.get('daily_logs', {})
        habits = user_data.get('habits', [])

        # 2. Run Pattern Detection
        detector = PatternDetector(min_data_points=2) # Lowered threshold for testing
        report = detector.generate_report(daily_logs, habits)

        # 3. Return Insights
        return jsonify(report), 200

    except Exception as e:
        print(f"SERVER ERROR: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    # debug=True allows hot-reloading when you change code locally
    app.run(debug=True, host='0.0.0.0', port=port)