"""
Outfit Bundle API - Flask API for AWS Lambda + API Gateway
"""
import json
import base64
import tempfile
import os
from outfit_bundle_agent import OutfitBundleAgent

def lambda_handler(event, context):
    """
    AWS Lambda handler for API Gateway
    
    Expected POST body:
    {
        "images": ["base64_encoded_image1", "base64_encoded_image2"],
        "age": "25",
        "gender": "female",
        "occasion": "garden party",
        "season": "summer",
        "budget": 200
    }
    """
    try:
        # Parse request body
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event
        
        # Extract parameters
        images_base64 = body.get('images', [])
        age = body.get('age')
        gender = body.get('gender')
        occasion = body.get('occasion')
        season = body.get('season')
        budget = body.get('budget', 200)
        
        if not images_base64:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'No images provided'})
            }
        
        # Save base64 images to temporary files
        temp_files = []
        for i, img_base64 in enumerate(images_base64):
            # Remove data URL prefix if present
            if ',' in img_base64:
                img_base64 = img_base64.split(',')[1]
            
            # Decode base64
            img_data = base64.b64decode(img_base64)
            
            # Save to temp file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            temp_file.write(img_data)
            temp_file.close()
            temp_files.append(temp_file.name)
        
        # Create agent and run
        agent = OutfitBundleAgent(
            budget=budget,
            age=age,
            gender=gender,
            occasion=occasion,
            season=season
        )
        
        # Get products
        shoes, handbags, jewelry, clothing, other_accessories = agent.get_products_from_dynamodb()
        
        if not shoes:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'No products found in database'})
            }
        
        # Analyze all outfits
        outfit_descriptions = []
        for temp_file in temp_files:
            outfit_description = agent.analyze_outfit(temp_file)
            outfit_descriptions.append(outfit_description)
        
        # Combine descriptions
        combined_description = "\n\n".join([
            f"OUTFIT {i+1}:\n{desc}"
            for i, desc in enumerate(outfit_descriptions)
        ])
        
        # Create bundles
        bundles = agent.create_bundles(combined_description, shoes, handbags, jewelry, clothing, other_accessories)
        
        # Build response
        output = {
            "outfits_count": len(temp_files),
            "context": {
                "age": age,
                "gender": gender,
                "occasion": occasion,
                "season": season,
                "budget": budget
            },
            "bundles": []
        }
        
        for i, bundle in enumerate(bundles, 1):
            items_data = []
            
            for item in bundle['items']:
                product = item['product']
                items_data.append({
                    "category": item['category'],
                    "product_name": product.get('product_name'),
                    "price": product.get('price_float', 0),
                    "product_id": product.get('product_id'),
                    "product_url": product.get('product_url'),
                    "image_url": product.get('original_image_url'),
                    "reason": item['reason']
                })
            
            bundle_data = {
                "bundle_number": i,
                "bundle_name": bundle['bundle_name'],
                "bundle_type": bundle.get('bundle_type', 'standard'),
                "match_score": bundle['match_score'],
                "total_cost": bundle['total_cost'],
                "items": items_data,
                "styling_note": bundle['styling_note']
            }
            
            output["bundles"].append(bundle_data)
        
        # Clean up temp files
        for temp_file in temp_files:
            try:
                os.unlink(temp_file)
            except:
                pass
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(output)
        }
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e),
                'trace': error_trace
            })
        }


# For local testing with Flask
if __name__ == '__main__':
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    
    app = Flask(__name__)
    CORS(app)
    
    @app.route('/outfit-bundles', methods=['POST', 'OPTIONS'])
    def outfit_bundles():
        if request.method == 'OPTIONS':
            return '', 200
        
        # Convert Flask request to Lambda event format
        event = {
            'body': json.dumps(request.get_json())
        }
        
        # Call Lambda handler
        response = lambda_handler(event, None)
        
        return jsonify(json.loads(response['body'])), response['statusCode']
    
    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({'status': 'healthy'}), 200
    
    print("Starting Outfit Bundle API on http://localhost:5000")
    print("POST to http://localhost:5000/outfit-bundles")
    app.run(host='0.0.0.0', port=5000, debug=True)
