"""
SINGLE SCRIPT - Lead Enrichment for Sales Pipeline
===================================================
Input: Company name, website domain, location (from Google Maps scraping)
Output: Decision maker name, job title, email, phone, company size

Usage:
1. Add your API keys below
2. Add your companies to the 'companies' list
3. Run: python enrich_leads.py
"""

import requests
import json
import time

# ============================================
# STEP 1: ADD YOUR API KEYS HERE
# ============================================
HUNTER_API_KEY = 'd09598ac7857fb066dccfa43969b1b4d2d0f0a7f'  # Get from hunter.io
APOLLO_API_KEY = '0YjXrvXCqH9wUqPWJzq9Dg'   # Get from apollo.io


# ============================================
# STEP 2: COMPANIES WILL BE ENTERED BY USER
# ============================================
# No need to edit this - script will ask you!


# ============================================
# MAIN ENRICHMENT FUNCTION
# ============================================

def enrich_company(company_name, domain, location=None):
    """
    Get decision maker info and company size
    
    Input:
        company_name: "Acme Corp"
        domain: "acme.com" 
        location: "New York, NY" (optional)
    
    Output:
        {
            'company_name': 'Acme Corp',
            'company_size': 250,
            'industry': 'Technology',
            'decision_makers': [
                {
                    'name': 'John Smith',
                    'job_title': 'CEO',
                    'email': 'john@acme.com',
                    'phone': '+1234567890'
                }
            ]
        }
    """
    
    result = {
        'company_name': company_name,
        'domain': domain,
        'location': location,
        'company_size': None,
        'industry': None,
        'decision_makers': []
    }
    
    # Clean domain (remove https://, www., trailing slash, etc)
    domain = domain.replace('https://', '').replace('http://', '').replace('www.', '')
    domain = domain.rstrip('/')  # Remove trailing slash
    domain = domain.split('/')[0]  # Get only the domain part
    
    print(f"\n🔍 Searching for: {company_name}")
    print(f"   Cleaned Domain: {domain}")
    
    # Get data from Apollo.io (this gives everything!)
    apollo_data = get_apollo_data(domain, company_name)
    
    if apollo_data:
        result['company_size'] = apollo_data.get('company_size')
        result['industry'] = apollo_data.get('industry')
        result['decision_makers'] = apollo_data.get('decision_makers', [])
        
        if result['decision_makers']:
            print(f"   ✅ Found {len(result['decision_makers'])} decision makers from Apollo")
        else:
            print(f"   ⚠️ Apollo found company but no decision makers")
            # Try Hunter.io for emails
            print(f"   🔍 Trying Hunter.io for email addresses...")
            hunter_data = get_hunter_data(domain)
            if hunter_data:
                result['decision_makers'] = hunter_data
                print(f"   ✅ Found {len(result['decision_makers'])} decision makers from Hunter")
    else:
        # Fallback to Hunter.io for emails
        print(f"   ⚠️ Apollo didn't find company data, trying Hunter.io...")
        hunter_data = get_hunter_data(domain)
        if hunter_data:
            result['decision_makers'] = hunter_data
            print(f"   ✅ Found {len(result['decision_makers'])} decision makers from Hunter")
    
    return result


def get_apollo_data(domain, company_name):
    """Get everything from Apollo.io - company size + decision makers"""
    
    if not APOLLO_API_KEY or APOLLO_API_KEY == 'YOUR_APOLLO_API_KEY':
        print("   ⚠️ No Apollo API key")
        return None
    
    # 1. Get company size
    company_url = "https://api.apollo.io/v1/organizations/enrich"
    company_params = {'domain': domain}
    company_headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': APOLLO_API_KEY
    }
    
    company_size = None
    industry = None
    
    try:
        response = requests.get(company_url, params=company_params, headers=company_headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            org = data.get('organization', {})
            company_size = org.get('estimated_num_employees')
            industry = org.get('industry')
            print(f"   ✅ Apollo found company data")
        else:
            print(f"   ⚠️ Apollo company API returned status: {response.status_code}")
    except Exception as e:
        print(f"   ⚠️ Apollo company data error: {e}")
    
    # 2. Get decision makers
    people_url = "https://api.apollo.io/v1/mixed_people/search"
    people_payload = {
        "q_organization_domains": domain,
        "person_titles": [
            "CEO", "Chief Executive Officer",
            "CTO", "Chief Technology Officer",
            "CFO", "Chief Financial Officer", 
            "VP", "Vice President",
            "Director", "Head of"
        ],
        "page": 1,
        "per_page": 10
    }
    
    decision_makers = []
    
    try:
        response = requests.post(people_url, json=people_payload, headers=company_headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            people = data.get('people', [])
            
            print(f"   🔍 Apollo found {len(people)} people")
            
            for person in people:
                decision_makers.append({
                    'name': person.get('name'),
                    'job_title': person.get('title'),
                    'email': person.get('email'),
                    'phone': person.get('phone_numbers', [{}])[0].get('raw_number') if person.get('phone_numbers') else None,
                    'linkedin': person.get('linkedin_url')
                })
        else:
            print(f"   ⚠️ Apollo people API returned status: {response.status_code}")
            if response.status_code == 422:
                print(f"   ⚠️ Response: {response.text[:200]}")
    except Exception as e:
        print(f"   ⚠️ Apollo people search error: {e}")
    
    if company_size or decision_makers:
        return {
            'company_size': company_size,
            'industry': industry,
            'decision_makers': decision_makers
        }
    
    return None


def get_hunter_data(domain):
    """Fallback: Get emails from Hunter.io"""
    
    if not HUNTER_API_KEY or HUNTER_API_KEY == 'YOUR_HUNTER_API_KEY':
        print("   ⚠️ No Hunter API key")
        return []
    
    url = "https://api.hunter.io/v2/domain-search"
    params = {
        'domain': domain,
        'api_key': HUNTER_API_KEY,
        'limit': 10
    }
    
    decision_makers = []
    
    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            emails = data.get('data', {}).get('emails', [])
            
            print(f"   🔍 Hunter found {len(emails)} total emails")
            
            # Filter for decision maker titles
            titles = ['CEO', 'CTO', 'VP', 'Director', 'Manager', 'Head', 'Chief', 'Founder', 'Owner', 'President']
            
            for email_data in emails:
                position = email_data.get('position', '').lower()
                if any(title.lower() in position for title in titles):
                    decision_makers.append({
                        'name': f"{email_data.get('first_name', '')} {email_data.get('last_name', '')}".strip(),
                        'job_title': email_data.get('position'),
                        'email': email_data.get('value'),
                        'phone': email_data.get('phone_number'),
                        'linkedin': None
                    })
            
            print(f"   ✅ Hunter filtered to {len(decision_makers)} decision makers")
        else:
            print(f"   ⚠️ Hunter API returned status: {response.status_code}")
    except Exception as e:
        print(f"   ⚠️ Hunter error: {e}")
    
    return decision_makers


# ============================================
# GET INPUT FROM USER
# ============================================

def get_companies_from_user():
    """Ask user to input company details"""
    companies = []
    
    print("\n" + "=" * 60)
    print("LEAD ENRICHMENT TOOL")
    print("=" * 60)
    print("\nEnter company details (press Enter with empty name to finish)\n")
    
    while True:
        print(f"\n--- Company #{len(companies) + 1} ---")
        
        company_name = input("Company Name: ").strip()
        
        if not company_name:
            if len(companies) == 0:
                print("❌ You need to enter at least one company!")
                continue
            else:
                break
        
        domain = input("Website/Domain (e.g., acme.com): ").strip()
        
        if not domain:
            print("❌ Domain is required!")
            continue
        
        location = input("Location (optional): ").strip()
        
        companies.append({
            'company_name': company_name,
            'website': domain,
            'location': location if location else None
        })
        
        print(f"✅ Added: {company_name}")
        
        # Ask if they want to add more
        more = input("\nAdd another company? (y/n): ").strip().lower()
        if more != 'y':
            break
    
    return companies


# ============================================
# RUN THE ENRICHMENT
# ============================================

if __name__ == "__main__":
    
    # Get companies from user input
    companies = get_companies_from_user()
    
    print("=" * 60)
    print("LEAD ENRICHMENT STARTING")
    print("=" * 60)
    print(f"Total companies to process: {len(companies)}\n")
    
    all_results = []
    
    for i, company in enumerate(companies, 1):
        print(f"\n[{i}/{len(companies)}] Processing...")
        
        # Get the data
        result = enrich_company(
            company_name=company['company_name'],
            domain=company['website'],
            location=company.get('location')
        )
        
        # Show results
        if result['decision_makers']:
            print(f"\n   📋 Decision Makers:")
            for dm in result['decision_makers'][:3]:  # Show first 3
                print(f"      • {dm['name']} - {dm['job_title']}")
                print(f"        Email: {dm['email']}")
                if dm.get('phone'):
                    print(f"        Phone: {dm['phone']}")
        else:
            print(f"   ❌ No decision makers found")
        
        all_results.append(result)
        
        # Don't hit API rate limits
        time.sleep(1)
    
    # Save results to JSON file
    with open('enriched_results.json', 'w') as f:
        json.dump(all_results, f, indent=2)
    
    # Print summary
    print("\n" + "=" * 60)
    print("ENRICHMENT COMPLETE!")
    print("=" * 60)
    print(f"✅ Processed: {len(all_results)} companies")
    print(f"✅ Results saved to: enriched_results.json")
    
    total_decision_makers = sum(len(r['decision_makers']) for r in all_results)
    companies_with_size = sum(1 for r in all_results if r['company_size'])
    
    print(f"\n📊 Summary:")
    print(f"   • Total decision makers found: {total_decision_makers}")
    print(f"   • Companies with size data: {companies_with_size}/{len(all_results)}")
    print("\n")