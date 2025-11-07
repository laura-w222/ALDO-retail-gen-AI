"""
Outfit Bundle Agent - Suggests complete bundles of shoes and accessories for outfits
"""
import boto3
import json
import base64
import sys
import os

class OutfitBundleAgent:
    def __init__(self, budget=200, age=None, gender=None, occasion=None, season=None):
        self.s3 = boto3.client('s3', region_name='us-east-1')
        self.bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
        self.dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        self.table = self.dynamodb.Table('aldo-product-metadata')
        self.bucket_name = 'aldo-images'
        self.budget = budget
        self.age = age
        self.gender = gender
        self.occasion = occasion
        self.season = season
        
    def analyze_outfit(self, image_path):
        """Analyze the outfit image and get description"""
        
        with open(image_path, 'rb') as f:
            image_bytes = base64.b64encode(f.read()).decode('utf-8')
        
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_bytes
                            }
                        },
                        {
                            "type": "text",
                            "text": "Describe this outfit in detail, focusing on colors, style, and formality. What type of shoes and accessories would complement this outfit best?"
                        }
                    ]
                }
            ]
        }
        
        response = self.bedrock.invoke_model(
            modelId='us.anthropic.claude-3-5-sonnet-20241022-v2:0',
            body=json.dumps(request_body)
        )
        
        response_body = json.loads(response['body'].read())
        outfit_description = response_body['content'][0]['text']
        
        return outfit_description
    
    def get_products_from_dynamodb(self, limit=30):
        """Get products from DynamoDB within budget + premium range, separated by type (optimized)"""
        premium_budget = self.budget + 75  # Increased from 50 to 75
        
        try:
            # Limit scan to reduce time - only get what we need
            response = self.table.scan(Limit=300)  # Increased to get more variety
            items = response.get('Items', [])
            
            # Separate products by type and filter by premium budget
            shoes = []
            handbags = []
            jewelry = []
            clothing = []
            other_accessories = []
            
            for item in items:
                price_str = str(item.get('price', '0'))
                price = float(price_str.replace('$', '').replace(',', ''))
                item['price_float'] = price
                
                # Include items up to premium budget
                if price > premium_budget:
                    continue
                
                product_type = item.get('product_type', '').upper()
                product_name = item.get('product_name', '').lower()
                description = item.get('description', '').lower()
                
                # Categorize products
                if product_type == 'FOOTWEAR' and len(shoes) < limit:
                    shoes.append(item)
                    
                elif len(handbags) < limit and (product_type in ['BAG', 'HANDBAG', 'HANDBAGS'] or
                      'bag' in product_name or 'handbag' in product_name or 
                      'tote' in product_name or 'purse' in product_name or
                      'clutch' in product_name or 'crossbody' in product_name):
                    handbags.append(item)
                    
                elif len(jewelry) < limit and (product_type in ['JEWELRY', 'JEWELLERY'] or
                      'necklace' in product_name or 'earring' in product_name or
                      'bracelet' in product_name or 'ring' in product_name or
                      'jewelry' in product_name or 'jewellery' in product_name):
                    jewelry.append(item)
                    
                elif len(clothing) < limit and product_type in ['CLOTHING', 'APPAREL', 'TOP', 'BOTTOM', 'DRESS']:
                    clothing.append(item)
                    
                elif len(other_accessories) < limit and (product_type in ['ACCESSORIES', 'ACCESSORY'] or
                      'scarf' in product_name or 'hat' in product_name or
                      'belt' in product_name or 'sunglasses' in product_name or
                      'wallet' in product_name):
                    other_accessories.append(item)
                
                # Stop early if we have enough of each
                if (len(shoes) >= limit and len(handbags) >= limit and 
                    len(jewelry) >= limit and len(clothing) >= limit and 
                    len(other_accessories) >= limit):
                    break
            
            return shoes, handbags, jewelry, clothing, other_accessories
            
        except Exception as e:
            print(f"Error fetching from DynamoDB: {e}")
            return [], [], [], [], []
    
    def create_bundles(self, outfit_description, shoes, handbags, jewelry, clothing, other_accessories):
        """Create outfit bundles using Claude"""
        
        # Prepare product descriptions - limit to 15 each for faster processing
        shoes_text = "\n".join([
            f"S{i+1}. {s.get('product_name')} (${s.get('price_float', 0):.2f}) - {s.get('description', 'No description')}"
            for i, s in enumerate(shoes[:15])
        ])
        
        handbags_text = "\n".join([
            f"H{i+1}. {h.get('product_name')} (${h.get('price_float', 0):.2f}) - {h.get('description', 'No description')}"
            for i, h in enumerate(handbags[:15])
        ])
        
        jewelry_text = "\n".join([
            f"J{i+1}. {j.get('product_name')} (${j.get('price_float', 0):.2f}) - {j.get('description', 'No description')}"
            for i, j in enumerate(jewelry[:15])
        ]) if jewelry else "No jewelry available"
        
        clothing_text = "\n".join([
            f"C{i+1}. {c.get('product_name')} (${c.get('price_float', 0):.2f}) - {c.get('description', 'No description')}"
            for i, c in enumerate(clothing[:15])
        ]) if clothing else "No clothing available"
        
        accessories_text = "\n".join([
            f"A{i+1}. {a.get('product_name')} (${a.get('price_float', 0):.2f}) - {a.get('description', 'No description')}"
            for i, a in enumerate(other_accessories[:15])
        ]) if other_accessories else "No other accessories available"
        
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2000,  # Reduced from 4000 for faster response
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"""I need to match shoes and handbags with these outfits:

{outfit_description}

CONTEXT:
Age: {self.age if self.age else 'Not specified'}
Gender: {self.gender if self.gender else 'Not specified'}
Occasion: {self.occasion if self.occasion else 'Not specified'}
Season: {self.season if self.season else 'Not specified'}

AVAILABLE PRODUCTS:

SHOES:
{shoes_text}

HANDBAGS:
{handbags_text}

JEWELRY:
{jewelry_text}

CLOTHING:
{clothing_text}

OTHER ACCESSORIES:
{accessories_text}

Create EXACTLY 3 bundles that work well with ALL the outfits described above, considering the age, gender, occasion, and season:
- Bundle 1: Within budget (under ${self.budget}) - can have 1-3 items
- Bundle 2: Within budget (under ${self.budget}) - can have 1-3 items  
- Bundle 3: Premium upgrade (${self.budget + 50} to ${self.budget + 75}) - can have 1-3 items

Each bundle MUST have:
- 1 pair of shoes (REQUIRED - always include)
- 0-2 additional items from: handbags, jewelry, clothing, or other accessories (OPTIONAL)
- Match score (1-10) for how well the bundle complements ALL the outfits and context
- Brief styling note explaining how it works with all outfits and the occasion/season

CRITICAL REQUIREMENTS: 
- Bundle 1 and Bundle 2 MUST stay UNDER ${self.budget}
- Bundle 3 MUST be between ${self.budget + 50} and ${self.budget + 75} (exactly $50-75 above budget)
- You MUST return exactly 3 bundles, no more, no less
- If you cannot create a bundle in the premium range, add more expensive items to reach the target price range

Respond with a JSON array:
[{{
  "bundle_name": "Bundle name",
  "bundle_type": "budget/mid-range/premium",
  "match_score": 9,
  "total_cost": 150.50,
  "items": [
    {{"id": "S1", "category": "shoes", "reason": "why it works"}},
    {{"id": "H1", "category": "handbag", "reason": "why it works"}}
  ],
  "styling_note": "How to wear this bundle"
}}]"""
                        }
                    ]
                }
            ]
        }
        
        try:
            bedrock_response = self.bedrock.invoke_model(
                modelId='us.anthropic.claude-3-5-sonnet-20241022-v2:0',
                body=json.dumps(request_body)
            )
            
            response_body = json.loads(bedrock_response['body'].read())
            analysis_text = response_body['content'][0]['text']
            
            # Extract JSON from response
            start = analysis_text.find('[')
            end = analysis_text.rfind(']') + 1
            json_str = analysis_text[start:end]
            bundles = json.loads(json_str)
            
            # Map IDs back to actual products
            product_maps = {
                'S': {f"S{i+1}": s for i, s in enumerate(shoes[:20])},
                'H': {f"H{i+1}": h for i, h in enumerate(handbags[:20])},
                'J': {f"J{i+1}": j for i, j in enumerate(jewelry[:20])},
                'C': {f"C{i+1}": c for i, c in enumerate(clothing[:20])},
                'A': {f"A{i+1}": a for i, a in enumerate(other_accessories[:20])}
            }
            
            enriched_bundles = []
            within_budget_count = 0
            premium_count = 0
            
            for bundle in bundles:
                items_list = bundle.get('items', [])
                
                if not items_list:
                    continue
                
                enriched_items = []
                total_cost = 0
                
                for item in items_list:
                    item_id = item.get('id', '')
                    if not item_id:
                        continue
                    
                    # Get the product from the appropriate map
                    prefix = item_id[0]
                    product = product_maps.get(prefix, {}).get(item_id, {})
                    
                    if product:
                        enriched_items.append({
                            'product': product,
                            'category': item.get('category', 'unknown'),
                            'reason': item.get('reason', '')
                        })
                        total_cost += product.get('price_float', 0)
                
                if len(enriched_items) >= 1:  # At least one item (shoes)
                    # Validate budget constraints
                    bundle_cost = bundle.get('total_cost', total_cost)
                    bundle_type = bundle.get('bundle_type', 'standard')
                    
                    # Check if this bundle fits our requirements
                    if bundle_cost < self.budget and within_budget_count < 2:
                        within_budget_count += 1
                        enriched_bundles.append({
                            'bundle_name': bundle.get('bundle_name', f'Within Budget Bundle {within_budget_count}'),
                            'bundle_type': 'within_budget',
                            'match_score': bundle.get('match_score', 0),
                            'total_cost': bundle_cost,
                            'items': enriched_items,
                            'styling_note': bundle.get('styling_note', '')
                        })
                    elif (bundle_cost >= self.budget + 50 and bundle_cost <= self.budget + 75 and premium_count < 1):
                        premium_count += 1
                        enriched_bundles.append({
                            'bundle_name': bundle.get('bundle_name', 'Premium Bundle'),
                            'bundle_type': 'premium',
                            'match_score': bundle.get('match_score', 0),
                            'total_cost': bundle_cost,
                            'items': enriched_items,
                            'styling_note': bundle.get('styling_note', '')
                        })
            
            # Ensure we have exactly 3 bundles with correct distribution
            if len(enriched_bundles) != 3 or within_budget_count != 2 or premium_count != 1:
                print(f"Warning: Bundle distribution not optimal. Got {within_budget_count} within budget, {premium_count} premium")
            
            return enriched_bundles[:3]  # Ensure exactly 3 bundles
            
        except Exception as e:
            print(f"Error creating bundles: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def display_bundles(self, bundles, outfit_names):
        """Display the bundles in JSON format"""
        output = {
            "outfits": outfit_names if isinstance(outfit_names, list) else [outfit_names],
            "context": {
                "age": self.age,
                "gender": self.gender,
                "occasion": self.occasion,
                "season": self.season,
                "budget": self.budget
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
        
        print(json.dumps(output, indent=2))
        

    
    def run(self, outfit_images):
        """Main agent execution for multiple outfit images"""
        try:
            # Get products once
            shoes, handbags, jewelry, clothing, other_accessories = self.get_products_from_dynamodb()
            
            if not shoes:
                return {}
            
            # Step 1: Analyze all outfits
            outfit_descriptions = []
            valid_images = []
            for outfit_image in outfit_images:
                if not os.path.exists(outfit_image):
                    continue
                outfit_description = self.analyze_outfit(outfit_image)
                outfit_descriptions.append(outfit_description)
                valid_images.append(os.path.basename(outfit_image))
            
            if not outfit_descriptions:
                return {}
            
            # Step 2: Combine all outfit descriptions
            combined_description = "\n\n".join([
                f"OUTFIT {i+1} ({valid_images[i]}):\n{desc}"
                for i, desc in enumerate(outfit_descriptions)
            ])
            
            # Step 3: Create bundles that work for all outfits
            bundles = self.create_bundles(combined_description, shoes, handbags, jewelry, clothing, other_accessories)
            
            # Step 4: Display results
            self.display_bundles(bundles, valid_images)
            
            return bundles
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {}


def main():
    if len(sys.argv) < 2:
        sys.exit(1)
    
    # Parse command line arguments
    import argparse
    parser = argparse.ArgumentParser(description='Outfit Bundle Agent')
    parser.add_argument('images', nargs='+', help='Outfit image paths')
    parser.add_argument('--budget', type=int, default=200, help='Budget in dollars (default: 200)')
    parser.add_argument('--age', type=str, help='Age or age range (e.g., "25" or "20-30")')
    parser.add_argument('--gender', type=str, help='Gender (e.g., "female", "male", "unisex")')
    parser.add_argument('--occasion', type=str, help='Occasion (e.g., "wedding", "birthday", "casual")')
    parser.add_argument('--season', type=str, help='Season (e.g., "summer", "winter", "spring", "fall")')
    
    args = parser.parse_args()
    
    agent = OutfitBundleAgent(
        budget=args.budget,
        age=args.age,
        gender=args.gender,
        occasion=args.occasion,
        season=args.season
    )
    agent.run(args.images)


if __name__ == "__main__":
    main()
