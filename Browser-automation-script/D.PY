"""
COMPLETE LEAD GENERATION & ENRICHMENT PIPELINE - IMPROVED
==========================================================
Features:
- Better anti-detection with realistic human behavior
- More stable browser handling
- Direct Google Sheets export only
- Improved error handling

Author: Enhanced Pipeline
Date: 2024
"""
import gspread
from google.oauth2.service_account import Credentials
from playwright.sync_api import sync_playwright
import requests
import json
import time
import random
from datetime import datetime

# ============================================
# API KEYS - ADD YOUR KEYS HERE
# ============================================
HUNTER_API_KEY = 'd09598ac7857fb066dccfa43969b1b4d2d0f0a7f'
APOLLO_API_KEY = '0YjXrvXCqH9wUqPWJzq9Dg'

# Google Sheets URL
SHEET_URL = "https://docs.google.com/spreadsheets/d/16TNh9y_Qf3avD0OhpkDPrcNTqhetthrDHmnx0ZdLBPs"


# ============================================
# ENHANCED HUMAN BEHAVIOR FUNCTIONS
# ============================================
def human_delay(min_sec=1, max_sec=3):
    """Enhanced random delay"""
    time.sleep(random.uniform(min_sec, max_sec))

def realistic_typing(page, text, wpm=45):
    """
    Type like a real human with realistic speed and variations
    wpm: words per minute (typical human: 40-50)
    """
    # Calculate delay between characters (in seconds)
    chars_per_second = (wpm * 5) / 60  # 5 chars per word average
    base_delay = 1 / chars_per_second
    
    for i, char in enumerate(text):
        page.keyboard.type(char)
        
        # Add realistic variations
        if char == ' ':
            time.sleep(base_delay * random.uniform(1.5, 2.5))  # Longer pause at spaces
        elif char in '.,!?':
            time.sleep(base_delay * random.uniform(2, 3))  # Even longer at punctuation
        else:
            # Add random variation to typing speed
            delay = base_delay * random.uniform(0.7, 1.3)
            time.sleep(delay)
        
        # Occasional longer pauses (thinking)
        if random.random() < 0.1:
            time.sleep(random.uniform(0.5, 1.5))

def random_mouse_movements(page, num_moves=3):
    """Simulate random mouse movements"""
    try:
        viewport = page.viewport_size
        for _ in range(num_moves):
            x = random.randint(100, viewport['width'] - 100)
            y = random.randint(100, viewport['height'] - 100)
            
            # Move in steps for more natural movement
            steps = random.randint(5, 10)
            page.mouse.move(x, y, steps=steps)
            time.sleep(random.uniform(0.1, 0.3))
    except:
        pass

def realistic_scroll(page, container_selector, pause_time=3):
    """More realistic scrolling behavior"""
    try:
        for i in range(10):  # More scrolls
            # Variable scroll distances
            scroll_amount = random.randint(200, 500)
            
            page.evaluate(f'''
                (selector) => {{
                    const container = document.querySelector(selector);
                    if (container) {{
                        container.scrollBy({{
                            top: {scroll_amount},
                            behavior: 'smooth'
                        }});
                    }}
                }}
            ''', container_selector)
            
            # Variable pause times
            time.sleep(random.uniform(pause_time - 1, pause_time + 1))
            
            # Occasionally scroll up (like reading)
            if random.random() < 0.2:
                scroll_up = random.randint(50, 150)
                page.evaluate(f'''
                    (selector) => {{
                        const container = document.querySelector(selector);
                        if (container) {{
                            container.scrollBy({{
                                top: -{scroll_up},
                                behavior: 'smooth'
                            }});
                        }}
                    }}
                ''', container_selector)
                time.sleep(random.uniform(0.5, 1.5))
            
            # Check if we've reached the end
            is_end = page.evaluate('''
                (selector) => {
                    const container = document.querySelector(selector);
                    if (!container) return true;
                    return container.scrollTop + container.clientHeight >= container.scrollHeight - 100;
                }
            ''', container_selector)
            
            if is_end and i > 4:
                print(f"    📜 Reached end after {i+1} scrolls")
                break
        
        # Random mouse movement while scrolling
        if random.random() < 0.3:
            random_mouse_movements(page, 2)
            
    except Exception as e:
        print(f"    ⚠️ Scroll error: {str(e)[:50]}")


# ============================================
# ENHANCED GOOGLE MAPS SCRAPER CLASS
# ============================================
class EnhancedGoogleMapsScraper:
    def __init__(self):
        self.companies = []
        self.browser = None
        self.context = None
        self.page = None
    
    def setup_browser(self):
        """Setup browser with enhanced anti-detection"""
        print("🌐 Setting up browser...")
        
        playwright = sync_playwright().start()
        
        self.browser = playwright.chromium.launch(
            headless=False,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-setuid-sandbox',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--start-maximized'
            ]
        )
        
        self.context = self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale='en-US',
            timezone_id='Asia/Karachi',
            geolocation={'latitude': 31.5204, 'longitude': 74.3587},
            permissions=['geolocation']
        )
        
        self.page = self.context.new_page()
        
        # Enhanced anti-detection scripts
        self.page.add_init_script("""
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // Add chrome object
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
            
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // Add plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // Add languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
        """)
        
        print("✅ Browser setup complete")
    
    def extract_website_from_detail_panel(self):
        """Extract website with multiple retry strategies"""
        try:
            # Wait for panel to load
            human_delay(3, 5)
            
            # Method 1: Direct data-item-id selector
            try:
                website_elem = self.page.locator('[data-item-id="authority"]').first
                if website_elem.count() > 0:
                    href = website_elem.get_attribute('href')
                    if href:
                        if '/url?q=' in href:
                            website = href.split('/url?q=')[1].split('&')[0]
                        else:
                            website = href
                        
                        from urllib.parse import unquote
                        website = unquote(website).rstrip('/').split('?')[0]
                        
                        if website.startswith('http') and 'google.com' not in website:
                            print(f"        ✅ Website: {website}")
                            return website
            except:
                pass
            
            # Method 2: JavaScript extraction
            try:
                website = self.page.evaluate("""
                    () => {
                        const panels = document.querySelectorAll('div[role="main"]');
                        const detailPanel = panels.length > 1 ? panels[1] : panels[0];
                        
                        if (!detailPanel) return null;
                        
                        const websiteElem = detailPanel.querySelector('[data-item-id="authority"]');
                        if (websiteElem) {
                            const href = websiteElem.href || websiteElem.getAttribute('href');
                            if (href && href.includes('http')) {
                                return href;
                            }
                            
                            const ariaLabel = websiteElem.getAttribute('aria-label');
                            if (ariaLabel && ariaLabel.includes('Website:')) {
                                const domain = ariaLabel.replace('Website:', '').trim();
                                return domain.startsWith('http') ? domain : 'https://' + domain;
                            }
                        }
                        
                        return null;
                    }
                """)
                
                if website:
                    if '/url?q=' in website:
                        website = website.split('/url?q=')[1].split('&')[0]
                    
                    from urllib.parse import unquote
                    website = unquote(website).rstrip('/').split('?')[0]
                    
                    if 'google.com' not in website:
                        print(f"        ✅ Website: {website}")
                        return website
            except:
                pass
            
            print(f"        ❌ No website found")
            return None
            
        except Exception as e:
            print(f"        ⚠️ Website extraction error: {str(e)[:40]}")
            return None
    
    def extract_company_details(self, listing):
        """Extract company details from a listing"""
        try:
            # Get company name
            company_name = None
            name_selectors = [
                'div[class*="fontHeadlineSmall"]',
                'div[class*="fontBodyMedium"]',
                'a[class*="hfpxzc"]'
            ]
            
            for selector in name_selectors:
                try:
                    name_elem = listing.locator(selector).first
                    if name_elem.count() > 0:
                        company_name = name_elem.inner_text(timeout=2000).strip()
                        if company_name:
                            break
                except:
                    continue
            
            if not company_name:
                return None
            
            print(f"    🔍 Checking: {company_name}")
            
            # Click listing with human-like delay
            try:
                # Random mouse movement before click
                if random.random() < 0.3:
                    random_mouse_movements(self.page, 2)
                
                listing.click(timeout=5000)
                print(f"    🖱️ Clicked, loading details...")
                human_delay(3, 6)  # Longer wait for panel
                
            except Exception as e:
                print(f"    ⚠️ Click failed: {str(e)[:30]}")
                return None
            
            company_data = {
                'name': company_name,
                'website': None,
                'address': None,
                'phone': None
            }
            
            # Extract website
            print(f"    🌐 Looking for website...")
            for attempt in range(2):
                company_data['website'] = self.extract_website_from_detail_panel()
                if company_data['website']:
                    break
                if attempt == 0:
                    human_delay(2, 3)
            
            # Extract address
            try:
                address_selectors = [
                    'button[data-item-id="address"]',
                    'button[aria-label*="Address"]'
                ]
                
                for selector in address_selectors:
                    try:
                        addr_elem = self.page.locator(selector).first
                        if addr_elem.count() > 0:
                            addr_text = addr_elem.get_attribute('aria-label')
                            if addr_text and 'Address:' in addr_text:
                                company_data['address'] = addr_text.replace('Address:', '').strip()
                                break
                    except:
                        continue
            except:
                pass
            
            # Extract phone
            try:
                phone_selectors = [
                    'button[data-item-id*="phone"]',
                    'button[aria-label*="Phone"]'
                ]
                for selector in phone_selectors:
                    try:
                        phone_elem = self.page.locator(selector).first
                        if phone_elem.count() > 0:
                            phone_text = phone_elem.get_attribute('aria-label')
                            if phone_text and 'Phone:' in phone_text:
                                company_data['phone'] = phone_text.replace('Phone:', '').strip()
                                break
                    except:
                        continue
            except:
                pass
            
            return company_data
            
        except Exception as e:
            print(f"    ⚠️ Extraction failed: {str(e)[:50]}")
            return None
    
    def scrape_google_maps(self, industry, location, num_companies=10):
        """Main scraping function"""
        print(f"\n🗺️ STEP 1: GOOGLE MAPS SCRAPING")
        print("=" * 70)
        print(f"Target: {num_companies} {industry} companies in {location}\n")
        
        try:
            self.setup_browser()
            
            # Navigate to Google Maps
            print("🌐 Opening Google Maps...")
            self.page.goto('https://www.google.com/maps', wait_until='domcontentloaded', timeout=60000)
            human_delay(4, 6)
            
            # Random mouse movements
            random_mouse_movements(self.page, 3)
            
            # Handle cookie consent
            try:
                consent_buttons = [
                    'button:has-text("Accept all")',
                    'button:has-text("Reject all")',
                    'button:has-text("I agree")'
                ]
                for selector in consent_buttons:
                    try:
                        btn = self.page.locator(selector).first
                        if btn.is_visible(timeout=3000):
                            btn.click()
                            human_delay(1, 2)
                            break
                    except:
                        continue
            except:
                pass
            
            # Perform search
            search_query = f"{industry} companies in {location}"
            print(f"🔍 Searching: '{search_query}'")
            
            try:
                search_box = self.page.locator('input[id="searchboxinput"]').first
                search_box.click()
                human_delay(0.5, 1)
                
                # Type like human
                realistic_typing(self.page, search_query, wpm=random.randint(40, 55))
                human_delay(1, 2)
                
                self.page.keyboard.press('Enter')
                
                print("⏳ Loading results...")
                self.page.wait_for_timeout(8000)
                human_delay(3, 5)
                
            except Exception as e:
                print(f"❌ Search error: {e}")
                return self.companies
            
            # Scroll to load results
            print("📜 Scrolling to load more results...")
            realistic_scroll(self.page, 'div[role="feed"]', pause_time=3)
            
            human_delay(2, 3)
            
            # Extract companies
            print("\n📊 Extracting company details...\n")
            listings = self.page.locator('div[role="feed"] > div > div[class]').all()
            print(f"Found {len(listings)} listings\n")
            
            companies_extracted = 0
            attempts = 0
            max_attempts = min(len(listings), num_companies * 4)
            
            for i, listing in enumerate(listings):
                if companies_extracted >= num_companies:
                    print(f"\n✅ Target reached: {num_companies} companies")
                    break
                
                if attempts >= max_attempts:
                    print(f"\n⚠️ Max attempts reached")
                    break
                
                attempts += 1
                
                try:
                    # Check if valid listing
                    if listing.locator('div[class*="fontHeadlineSmall"]').count() == 0:
                        continue
                    
                    company_data = self.extract_company_details(listing)
                    
                    if company_data and company_data['name']:
                        # Check duplicates
                        if any(c['name'].lower() == company_data['name'].lower() 
                              for c in self.companies):
                            print(f"    ⏭️ Duplicate: {company_data['name']}")
                            continue
                        
                        # Only add if we have a website
                        if company_data['website']:
                            self.companies.append(company_data)
                            companies_extracted += 1
                            
                            print(f"✅ {companies_extracted}. {company_data['name']}")
                            print(f"   🌐 {company_data['website']}")
                            if company_data.get('phone'):
                                print(f"   📞 {company_data['phone']}")
                            print()
                        else:
                            print(f"    ⏭️ Skipped (no website): {company_data['name']}")
                        
                        # Human-like pause between extractions
                        human_delay(1, 2)
                
                except Exception as e:
                    print(f"    ⚠️ Error on listing {i+1}: {str(e)[:50]}")
                    continue
            
            print(f"\n✅ Successfully scraped {len(self.companies)} companies!")
            
        except Exception as e:
            print(f"❌ Fatal error: {e}")
        
        return self.companies
    
    def cleanup(self):
        """Clean up browser resources"""
        try:
            if self.browser:
                print("\n⏳ Closing browser...")
                human_delay(2, 3)
                self.browser.close()
        except:
            pass


# ============================================
# SOCIAL MEDIA & ENRICHMENT (Simplified)
# ============================================
def extract_social_and_enrich(company, browser_page):
    """Extract social media and enrich data"""
    result = {
        'company_name': company['name'],
        'website': company['website'],
        'address': company.get('address', 'N/A'),
        'phone': company.get('phone', 'N/A'),
        'industry': 'N/A',
        'company_size': 'Unknown',
        'linkedin': 'Not Found',
        'facebook': 'Not Found',
        'twitter': 'Not Found',
        'instagram': 'Not Found',
        'youtube': 'Not Found',
        'pinterest': 'Not Found',
        'tiktok': 'Not Found',
        'github': 'Not Found',
        'decision_makers': []
    }
    
    # Extract social media links
    try:
        print(f"🔗 Extracting social media...")
        browser_page.goto(company['website'], wait_until='domcontentloaded', timeout=30000)
        human_delay(2, 3)
        
        # Get all links
        all_links = browser_page.evaluate("""
            () => {
                const links = Array.from(document.querySelectorAll('a[href]'));
                return links.map(a => a.href);
            }
        """)
        
        # Find social media links
        import re
        patterns = {
            'linkedin': r'(?:https?://)?(?:www\.)?linkedin\.com/(?:company|in)/[^\s\"\'<>]+',
            'facebook': r'(?:https?://)?(?:www\.)?facebook\.com/[^\s\"\'<>]+',
            'twitter': r'(?:https?://)?(?:www\.)?(?:twitter|x)\.com/[^\s\"\'<>]+',
            'instagram': r'(?:https?://)?(?:www\.)?instagram\.com/[^\s\"\'<>]+',
            'youtube': r'(?:https?://)?(?:www\.)?youtube\.com/(?:c/|channel/|user/|@)[^\s\"\'<>]+',
            'pinterest': r'(?:https?://)?(?:www\.)?pinterest\.com/[^\s\"\'<>]+',
            'tiktok': r'(?:https?://)?(?:www\.)?tiktok\.com/@[^\s\"\'<>]+',
            'github': r'(?:https?://)?(?:www\.)?github\.com/[^\s\"\'<>]+'
        }
        
        for link in all_links:
            for platform, pattern in patterns.items():
                if re.search(pattern, link, re.IGNORECASE):
                    clean_link = link.split('?')[0].split('#')[0]
                    if 'sharer' not in clean_link.lower() and 'share' not in clean_link.lower():
                        if result[platform] == 'Not Found':
                            result[platform] = clean_link
        
        # Count found socials
        found_socials = sum(1 for v in result.values() if isinstance(v, str) and v != 'Not Found' and v != 'N/A' and v != 'Unknown')
        print(f"   ✅ Found {found_socials} social media links")
        
    except Exception as e:
        print(f"   ⚠️ Social extraction failed: {str(e)[:50]}")
    
    # Enrich with decision makers
    try:
        print(f"👔 Enriching with decision makers...")
        enrichment = enrich_company(company['name'], company['website'], company.get('address'))
        
        result['industry'] = enrichment.get('industry') or 'N/A'
        result['company_size'] = enrichment.get('company_size') or 'Unknown'
        result['decision_makers'] = enrichment.get('decision_makers', [])
        
        dm_count = len(result['decision_makers'])
        if dm_count > 0:
            print(f"   ✅ Found {dm_count} decision maker(s)")
        else:
            print(f"   ⚠️ No decision makers found")
        
        if result['company_size'] != 'Unknown':
            print(f"   📏 Company Size: {result['company_size']} employees")
            
    except Exception as e:
        print(f"   ⚠️ Enrichment failed: {str(e)[:50]}")
    
    return result


def enrich_company(company_name, domain, location=None):
    """Get decision maker info and company size"""
    result = {
        'company_name': company_name,
        'domain': domain,
        'location': location,
        'company_size': None,
        'industry': None,
        'decision_makers': []
    }
    
    # Clean domain
    domain = domain.replace('https://', '').replace('http://', '').replace('www.', '')
    domain = domain.rstrip('/').split('/')[0]
    
    # Try Apollo first
    apollo_data = get_apollo_data(domain, company_name)
    if apollo_data:
        result['company_size'] = apollo_data.get('company_size')
        result['industry'] = apollo_data.get('industry')
        result['decision_makers'] = apollo_data.get('decision_makers', [])
    
    # Fallback to Hunter if no decision makers
    if not result['decision_makers']:
        hunter_data = get_hunter_data(domain)
        if hunter_data:
            result['decision_makers'] = hunter_data
    
    return result


def get_apollo_data(domain, company_name):
    """Get company data from Apollo.io"""
    if not APOLLO_API_KEY or APOLLO_API_KEY == 'YOUR_APOLLO_API_KEY':
        return None
    
    # Get company info
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
    except:
        pass
    
    # Get decision makers
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
            
            for person in people:
                decision_makers.append({
                    'name': person.get('name'),
                    'job_title': person.get('title'),
                    'email': person.get('email'),
                    'phone': person.get('phone_numbers', [{}])[0].get('raw_number') if person.get('phone_numbers') else None,
                    'linkedin': person.get('linkedin_url')
                })
    except:
        pass
    
    if company_size or decision_makers:
        return {
            'company_size': company_size,
            'industry': industry,
            'decision_makers': decision_makers
        }
    
    return None


def get_hunter_data(domain):
    """Get email data from Hunter.io"""
    if not HUNTER_API_KEY or HUNTER_API_KEY == 'YOUR_HUNTER_API_KEY':
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
    except:
        pass
    
    return decision_makers


# ============================================
# GOOGLE SHEETS EXPORT
# ============================================
def save_to_google_sheets(results):
    """Save leads directly to Google Sheets"""
    try:
        print("\n📊 Saving to Google Sheets...")
        
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
        
        creds = Credentials.from_service_account_file(
            "credentials.json",
            scopes=scopes
        )
        
        client = gspread.authorize(creds)
        sheet = client.open_by_url(SHEET_URL).sheet1
        
        # Headers
        headers = [
            "Company Name", "Website", "Address", "Phone",
            "Industry", "Company Size",
            "LinkedIn", "Facebook", "Twitter", "Instagram",
            "YouTube", "Pinterest", "TikTok", "GitHub",
            "Decision Maker Name", "Job Title", "Email",
            "DM Phone", "DM LinkedIn"
        ]
        
        # Add headers if sheet is empty
        if sheet.row_count == 0 or not sheet.get_all_values():
            sheet.append_row(headers)
        
        # Prepare rows
        rows = []
        for company in results:
            base = [
                company["company_name"],
                company["website"],
                company["address"],
                company["phone"],
                company["industry"],
                str(company["company_size"]),
                company["linkedin"],
                company["facebook"],
                company["twitter"],
                company["instagram"],
                company["youtube"],
                company["pinterest"],
                company["tiktok"],
                company["github"],
            ]
            
            if company["decision_makers"]:
                for dm in company["decision_makers"]:
                    rows.append(base + [
                        dm.get("name", "N/A"),
                        dm.get("job_title", "N/A"),
                        dm.get("email", "N/A"),
                        dm.get("phone", "N/A"),
                        dm.get("linkedin", "N/A")
                    ])
            else:
                rows.append(base + ["N/A", "N/A", "N/A", "N/A", "N/A"])
        
        # Upload to sheets
        sheet.append_rows(rows)
        print(f"✅ Successfully uploaded {len(rows)} rows to Google Sheets")
        print(f"🔗 View at: {SHEET_URL}")
        
    except Exception as e:
        print(f"❌ Google Sheets error: {e}")


# ============================================
# MAIN PIPELINE
# ============================================
def run_pipeline(industry, location, num_companies):
    """Run complete pipeline"""
    print("\n" + "🎯 " + "=" * 74 + " 🎯")
    print("       COMPLETE LEAD GENERATION PIPELINE")
    print("🎯 " + "=" * 74 + " 🎯\n")
    
    # Step 1: Scrape Google Maps
    scraper = EnhancedGoogleMapsScraper()
    companies = scraper.scrape_google_maps(industry, location, num_companies)
    
    if not companies:
        print("❌ No companies found. Exiting...")
        scraper.cleanup()
        return None
    
    # Step 2: Social Media & Enrichment
    print("\n🔗 STEP 2: SOCIAL MEDIA & ENRICHMENT")
    print("=" * 70)
    
    final_results = []
    
    try:
        for i, company in enumerate(companies, 1):
            print(f"\n[{i}/{len(companies)}] Processing: {company['name']}")
            print("-" * 70)
            
            result = extract_social_and_enrich(company, scraper.page)
            final_results.append(result)
            
            # Rate limiting
            human_delay(2, 4)
        
    finally:
        scraper.cleanup()
    
    # Step 3: Save to Google Sheets
    if final_results:
        save_to_google_sheets(final_results)
        
        # Display summary
        print("\n" + "=" * 80)
        print("📊 PIPELINE SUMMARY")
        print("=" * 80)
        print(f"\n✅ Total Companies: {len(final_results)}")
        print(f"🔗 Companies with LinkedIn: {sum(1 for r in final_results if r['linkedin'] != 'Not Found')}")
        print(f"👔 Total Decision Makers: {sum(len(r['decision_makers']) for r in final_results)}")
        print("\n✨ Pipeline Complete! ✨\n")
    
    return final_results


# ============================================
# MAIN EXECUTION
# ============================================
def main():
    """Main function"""
    print("\n" + "🎯 " + "=" * 74 + " 🎯")
    print("       LEAD GENERATION & ENRICHMENT PIPELINE")
    print("🎯 " + "=" * 74 + " 🎯\n")
    
    print("✨ Pipeline Steps:")
    print("   1️⃣ Scrape companies from Google Maps")
    print("   2️⃣ Extract social media profiles")
    print("   3️⃣ Enrich with decision maker data")
    print("   4️⃣ Save directly to Google Sheets\n")
    
    # Get user input
    industry = input("📊 Industry (e.g., software, IT, healthcare): ").strip()
    location = input("📍 Location (e.g., Lahore, New York, London): ").strip()
    
    try:
        num_companies = int(input("🔢 How many companies? (default: 10): ").strip() or "10")
        num_companies = min(num_companies, 50)
    except ValueError:
        num_companies = 10
    
    print("\n🚀 Starting pipeline...\n")
    
    # Run pipeline
    results = run_pipeline(industry, location, num_companies)
    
    if results:
        print(f"\n✅ Successfully processed {len(results)} companies")
        print(f"📊 View your data at: {SHEET_URL}")
    else:
        print("\n❌ No results generated")


if __name__ == "__main__":
    main()