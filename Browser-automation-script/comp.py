"""
COMPLETE LEAD GENERATION & ENRICHMENT PIPELINE
==============================================
Combines: Google Maps Scraping + Social Media Extraction + Lead Enrichment

Input: Industry, Location, Company Size, Number of Companies
Output: Complete lead data with decision makers, social profiles, and company info

Author: Combined Pipeline
Date: 2024
"""

from playwright.sync_api import sync_playwright
import requests
import json
import time
import random
import csv
import re
from urllib.parse import urlparse, unquote
from datetime import datetime
import sys
import signal

# ============================================
# API KEYS - ADD YOUR KEYS HERE
# ============================================
HUNTER_API_KEY = 'd09598ac7857fb066dccfa43969b1b4d2d0f0a7f'
APOLLO_API_KEY = '0YjXrvXCqH9wUqPWJzq9Dg'


# ============================================
# GOOGLE MAPS SCRAPER CLASS
# ============================================
class GoogleMapsScraper:
    def __init__(self):
        self.companies = []
        
    def human_delay(self, min_sec=0.5, max_sec=2):
        """Random delay to simulate human behavior"""
        time.sleep(random.uniform(min_sec, max_sec))
    
    def type_like_human(self, page, text):
        """Type text character by character with realistic variations"""
        for i, char in enumerate(text):
            page.keyboard.type(char)
            
            if char == ' ':
                time.sleep(random.uniform(0.1, 0.2))
            elif i > 0 and text[i-1] == ' ':
                time.sleep(random.uniform(0.15, 0.3))
            else:
                time.sleep(random.uniform(0.08, 0.18))
            
            if random.random() < 0.08:
                time.sleep(random.uniform(0.3, 0.5))
    
    def smooth_scroll(self, page, container_selector, scroll_pause_time=2):
        """Scroll within a container to load more results"""
        try:
            for i in range(8):
                page.evaluate('''
                    (selector) => {
                        const container = document.querySelector(selector);
                        if (container) {
                            container.scrollBy(0, container.clientHeight);
                        }
                    }
                ''', container_selector)
                time.sleep(scroll_pause_time)
                
                is_end = page.evaluate('''
                    (selector) => {
                        const container = document.querySelector(selector);
                        return container ? (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) : true;
                    }
                ''', container_selector)
                
                if is_end and i > 3:
                    break
        except Exception as e:
            print(f"    ⚠️  Scroll error: {str(e)[:50]}")
    
    def extract_website_from_detail_panel(self, page):
        """Extract the actual website URL from the company detail panel"""
        try:
            # Wait longer for detail panel to fully load
            time.sleep(3)
            
            # The detail panel is the SECOND div[role="main"] element
            try:
                detail_panel = page.locator('div[role="main"]').nth(1)
            except:
                # Fallback to first if only one exists
                detail_panel = page.locator('div[role="main"]').first
            
            # Method 1: Look for the website element with data-item-id="authority"
            try:
                website_element = detail_panel.locator('[data-item-id="authority"]').first
                
                if website_element.count() > 0:
                    print(f"        🔍 Found website element!")
                    
                    # Get href attribute
                    href = website_element.get_attribute('href')
                    if href:
                        print(f"        📎 Raw href: {href[:60]}")
                        
                        # Clean the URL
                        if '/url?q=' in href:
                            website = href.split('/url?q=')[1].split('&')[0]
                        else:
                            website = href
                        
                        # Remove trailing slash and query params
                        from urllib.parse import unquote
                        website = unquote(website).rstrip('/')
                        if '?' in website:
                            website = website.split('?')[0]
                        
                        # Make sure it's a valid URL
                        if website.startswith('http') and 'google.com' not in website:
                            print(f"        ✅ Extracted: {website}")
                            return website
                    
                    # Fallback: Try aria-label if href didn't work
                    aria_label = website_element.get_attribute('aria-label')
                    if aria_label and 'Website:' in aria_label:
                        # Extract domain from aria-label
                        domain = aria_label.replace('Website:', '').strip()
                        # Add https if not present
                        if not domain.startswith('http'):
                            website = f"https://{domain}"
                        else:
                            website = domain
                        
                        print(f"        ✅ Extracted from aria-label: {website}")
                        return website
            except Exception as e:
                print(f"        ⚠️  Method 1 failed: {str(e)[:40]}")
            
            # Method 2: Use JavaScript to extract directly
            try:
                website = page.evaluate("""
                    () => {
                        // Get the second main div (detail panel)
                        const panels = document.querySelectorAll('div[role="main"]');
                        const detailPanel = panels.length > 1 ? panels[1] : panels[0];
                        
                        if (!detailPanel) return null;
                        
                        // Find the website element
                        const websiteElem = detailPanel.querySelector('[data-item-id="authority"]');
                        if (websiteElem) {
                            // Try href first
                            const href = websiteElem.href || websiteElem.getAttribute('href');
                            if (href && href.includes('http')) {
                                return href;
                            }
                            
                            // Try aria-label
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
                    # Clean the URL
                    if '/url?q=' in website:
                        website = website.split('/url?q=')[1].split('&')[0]
                    
                    from urllib.parse import unquote
                    website = unquote(website).rstrip('/').split('?')[0]
                    
                    if 'google.com' not in website:
                        print(f"        ✅ JS extracted: {website}")
                        return website
            except Exception as e:
                print(f"        ⚠️  Method 2 failed: {str(e)[:40]}")
            
            # Method 3: Search all links in detail panel
            try:
                all_links = detail_panel.locator('a[href^="http"]').all()
                
                for link in all_links[:20]:
                    href = link.get_attribute('href') or ''
                    aria_label = link.get_attribute('aria-label') or ''
                    
                    # Check if this looks like a company website
                    if (('website' in aria_label.lower() or 
                         'Website:' in aria_label) and 
                        'google.com' not in href and 
                        'facebook.com' not in href and
                        'instagram.com' not in href and
                        'linkedin.com' not in href):
                        
                        website = href
                        if '/url?q=' in website:
                            website = website.split('/url?q=')[1].split('&')[0]
                        
                        from urllib.parse import unquote
                        website = unquote(website).rstrip('/').split('?')[0]
                        
                        print(f"        ✅ Found in links: {website}")
                        return website
            except Exception as e:
                print(f"        ⚠️  Method 3 failed: {str(e)[:40]}")
            
            print(f"        ❌ No website found after all methods")
            return None
            
        except Exception as e:
            print(f"        ⚠️  Website extraction error: {str(e)[:40]}")
            return None
    
    def extract_company_from_listing(self, page, listing):
        """Click a listing and extract all company details"""
        try:
            company_name = None
            try:
                # Try multiple selectors for company name
                name_selectors = [
                    'div[class*="fontHeadlineSmall"]',
                    'div[class*="fontBodyMedium"]',
                    'a[class*="hfpxzc"]'
                ]
                
                for selector in name_selectors:
                    name_elem = listing.locator(selector).first
                    if name_elem.count() > 0:
                        company_name = name_elem.inner_text(timeout=2000).strip()
                        if company_name:
                            break
            except Exception as e:
                print(f"    ⚠️  Name extraction error: {str(e)[:30]}")
                pass
            
            if not company_name:
                return None
            
            print(f"    🔍 Checking: {company_name}")
            
            # Click the listing to open detail panel
            try:
                listing.click(timeout=5000)
                print(f"    🖱️  Clicked, waiting for panel to load...")
                self.human_delay(3, 5)  # Wait longer for panel to fully load
            except Exception as e:
                print(f"    ⚠️  Click failed: {str(e)[:30]}")
                return None
            
            company_data = {
                'name': company_name,
                'website': None,
                'address': None,
                'phone': None
            }
            
            # Extract website with retry
            print(f"    🌐 Looking for website...")
            for attempt in range(2):
                company_data['website'] = self.extract_website_from_detail_panel(page)
                if company_data['website']:
                    print(f"    ✅ Found: {company_data['website']}")
                    break
                if attempt == 0:
                    time.sleep(1)  # Wait and retry
            
            if not company_data['website']:
                print(f"    ❌ No website found")
            
            # Extract address
            try:
                address_selectors = [
                    'button[data-item-id="address"]',
                    'button[aria-label*="Address"]',
                    'div[data-item-id="address"]'
                ]
                
                for selector in address_selectors:
                    address_elem = page.locator(selector).first
                    if address_elem.count() > 0:
                        addr_text = address_elem.get_attribute('aria-label')
                        if addr_text and 'Address:' in addr_text:
                            company_data['address'] = addr_text.replace('Address:', '').strip()
                        else:
                            try:
                                company_data['address'] = address_elem.inner_text(timeout=1000).strip()
                            except:
                                pass
                        if company_data['address']:
                            break
            except:
                pass
            
            # Extract phone
            try:
                phone_selectors = [
                    'button[data-item-id*="phone"]',
                    'button[aria-label*="Phone"]',
                    'a[data-item-id*="phone"]'
                ]
                for selector in phone_selectors:
                    phone_elem = page.locator(selector).first
                    if phone_elem.count() > 0:
                        phone_text = phone_elem.get_attribute('aria-label')
                        if phone_text and 'Phone:' in phone_text:
                            company_data['phone'] = phone_text.replace('Phone:', '').strip()
                        elif phone_text:
                            try:
                                company_data['phone'] = phone_elem.inner_text(timeout=1000).strip()
                            except:
                                pass
                        if company_data['phone']:
                            break
            except:
                pass
            
            return company_data
            
        except Exception as e:
            print(f"    ⚠️  Extraction failed: {str(e)[:50]}")
            return None
    
    def scrape_google_maps(self, industry, location, num_companies=10):
        """Scrape companies from Google Maps"""
        print(f"\n🗺️  STEP 1: GOOGLE MAPS SCRAPING")
        print("=" * 70)
        print(f"Looking for {num_companies} {industry} companies in {location}...")
        
        browser = None
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=False,
                    args=[
                        '--disable-blink-features=AutomationControlled',
                        '--disable-dev-shm-usage',
                        '--no-sandbox',
                        '--start-maximized'
                    ]
                )
                
                context = browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    locale='en-US',
                    timezone_id='Asia/Karachi'
                )
                
                page = context.new_page()
                
                page.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                    window.chrome = { runtime: {} };
                """)
                
                try:
                    print("🌐 Opening Google Maps...")
                    page.goto('https://www.google.com/maps', wait_until='domcontentloaded', timeout=30000)
                    self.human_delay(3, 5)
                    
                    # Handle cookie consent
                    try:
                        consent_selectors = [
                            'button:has-text("Accept all")',
                            'button:has-text("Reject all")',
                            'button:has-text("I agree")'
                        ]
                        for selector in consent_selectors:
                            try:
                                btn = page.locator(selector).first
                                if btn.is_visible(timeout=2000):
                                    btn.click()
                                    self.human_delay(1, 2)
                                    break
                            except:
                                continue
                    except:
                        pass
                    
                    # Search
                    search_query = f"{industry} companies in {location}"
                    print(f"🔍 Searching: '{search_query}'")
                    
                    try:
                        search_box = page.locator('input[id="searchboxinput"]').first
                        search_box.click()
                        self.human_delay(0.5, 1)
                        self.type_like_human(page, search_query)
                        self.human_delay(1, 1.5)
                        page.keyboard.press('Enter')
                        
                        print("⏳ Loading results...")
                        page.wait_for_timeout(5000)
                        self.human_delay(2, 3)
                        
                    except Exception as e:
                        print(f"❌ Search error: {e}")
                        return self.companies
                    
                    # Scroll to load results
                    print("📜 Scrolling to load more results...")
                    results_container = 'div[role="feed"]'
                    self.smooth_scroll(page, results_container, scroll_pause_time=2.5)
                    
                    time.sleep(2)
                    
                    # Get all listings
                    print("\n📊 Extracting company details...")
                    listings = page.locator('div[role="feed"] > div > div[class]').all()
                    print(f"Found {len(listings)} listings\n")
                    
                    companies_extracted = 0
                    attempts = 0
                    max_attempts = min(len(listings), num_companies * 3)  # Try up to 3x the target
                    
                    for i, listing in enumerate(listings):
                        if companies_extracted >= num_companies or attempts >= max_attempts:
                            break
                        
                        attempts += 1
                        
                        try:
                            # Check if it's a valid company listing
                            if listing.locator('div[class*="fontHeadlineSmall"]').count() == 0:
                                continue
                            
                            company_data = self.extract_company_from_listing(page, listing)
                            
                            if company_data and company_data['name']:
                                # Check for duplicates
                                if any(c['name'].lower() == company_data['name'].lower() 
                                      for c in self.companies):
                                    print(f"    ⏭️  Duplicate: {company_data['name']}")
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
                                    print(f"    ⏭️  Skipped (no website): {company_data['name']}")
                                    
                                self.human_delay(0.3, 0.8)
                        
                        except Exception as e:
                            print(f"    ⚠️  Error on listing {i+1}: {str(e)[:50]}")
                            continue
                    
                    print(f"\n✅ Successfully scraped {len(self.companies)} companies with websites!")
                    
                    if len(self.companies) == 0:
                        print("\n⚠️  No companies found with websites. Try:")
                        print("   • Different industry keyword")
                        print("   • More specific location")
                        print("   • Check if Google Maps has results for this search")
                    
                except Exception as e:
                    print(f"❌ Error during scraping: {e}")
                
                finally:
                    if browser:
                        print("\n⏳ Closing browser...")
                        try:
                            self.human_delay(1, 2)
                            browser.close()
                        except:
                            pass
        
        except Exception as e:
            print(f"❌ Fatal error: {e}")
        
        return self.companies


# ============================================
# SOCIAL MEDIA SCRAPER CLASS
# ============================================
class SocialMediaScraper:
    def __init__(self):
        self.social_links = {}
        
    def reset_links(self):
        """Reset social links for new company"""
        self.social_links = {
            'linkedin': None,
            'facebook': None,
            'twitter': None,
            'instagram': None,
            'youtube': None,
            'pinterest': None,
            'tiktok': None,
            'github': None
        }
    
    def human_delay(self, min_sec=0.5, max_sec=2):
        time.sleep(random.uniform(min_sec, max_sec))
    
    def random_mouse_movement(self, page):
        try:
            for _ in range(random.randint(2, 4)):
                x = random.randint(100, 1000)
                y = random.randint(100, 700)
                page.mouse.move(x, y)
                time.sleep(random.uniform(0.1, 0.3))
        except:
            pass
    
    def human_scroll(self, page):
        """Simulate human-like scrolling"""
        try:
            page_height = page.evaluate("document.body.scrollHeight")
            current_position = 0
            scroll_count = 0
            max_scrolls = random.randint(5, 8)
            
            while current_position < page_height and scroll_count < max_scrolls:
                scroll_distance = random.randint(300, 600)
                page.evaluate(f"window.scrollBy(0, {scroll_distance})")
                current_position += scroll_distance
                scroll_count += 1
                time.sleep(random.uniform(0.5, 1.5))
                
                if random.random() < 0.25:
                    scroll_up = random.randint(50, 200)
                    page.evaluate(f"window.scrollBy(0, -{scroll_up})")
                    current_position -= scroll_up
            
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(random.uniform(0.5, 1.0))
        except:
            pass
    
    def extract_social_links(self, page, url, company_name):
        """Extract social media links from website"""
        self.reset_links()
        
        try:
            page.goto(url, wait_until='domcontentloaded', timeout=30000)
            self.human_delay(2, 3)
            self.human_scroll(page)
            
            all_links = page.evaluate("""
                () => {
                    const links = Array.from(document.querySelectorAll('a[href]'));
                    return links.map(a => a.href);
                }
            """)
            
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
                        
                        if (not self.social_links[platform] and 
                            'sharer' not in clean_link.lower() and
                            'share' not in clean_link.lower()):
                            self.social_links[platform] = clean_link
            
            page_content = page.content()
            for platform, pattern in patterns.items():
                if not self.social_links[platform]:
                    matches = re.findall(pattern, page_content, re.IGNORECASE)
                    for match in matches:
                        clean_link = match.split('?')[0].split('#')[0].strip('"\'')
                        if ('sharer' not in clean_link.lower() and 
                            'share' not in clean_link.lower()):
                            if not clean_link.startswith('http'):
                                clean_link = 'https://' + clean_link
                            self.social_links[platform] = clean_link
                            break
            
            return self.social_links.copy()
            
        except Exception as e:
            return self.social_links.copy()


# ============================================
# LEAD ENRICHMENT FUNCTIONS
# ============================================
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
    domain = domain.rstrip('/')
    domain = domain.split('/')[0]
    
    apollo_data = get_apollo_data(domain, company_name)
    
    if apollo_data:
        result['company_size'] = apollo_data.get('company_size')
        result['industry'] = apollo_data.get('industry')
        result['decision_makers'] = apollo_data.get('decision_makers', [])
        
        if not result['decision_makers']:
            hunter_data = get_hunter_data(domain)
            if hunter_data:
                result['decision_makers'] = hunter_data
    else:
        hunter_data = get_hunter_data(domain)
        if hunter_data:
            result['decision_makers'] = hunter_data
    
    return result


def get_apollo_data(domain, company_name):
    """Get company data from Apollo.io"""
    
    if not APOLLO_API_KEY or APOLLO_API_KEY == 'YOUR_APOLLO_API_KEY':
        return None
    
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
# MAIN PIPELINE FUNCTION
# ============================================
def run_complete_pipeline(industry, location, num_companies):
    """
    Run the complete lead generation pipeline
    
    Steps:
    1. Scrape Google Maps for companies
    2. Extract social media links for each
    3. Enrich with decision maker data
    4. Filter by company size if needed
    5. Save complete results
    """
    
    print("\n" + "=" * 80)
    print("🚀 COMPLETE LEAD GENERATION & ENRICHMENT PIPELINE")
    print("=" * 80)
    print(f"\nConfiguration:")
    print(f"  📊 Industry: {industry}")
    print(f"  📍 Location: {location}")
    print(f"  🔢 Target: {num_companies} companies")
    print()
    
    # Step 1: Google Maps Scraping
    maps_scraper = GoogleMapsScraper()
    companies = maps_scraper.scrape_google_maps(industry, location, num_companies)
    
    if not companies:
        print("❌ No companies found. Exiting...")
        return None
    
    # Step 2 & 3: Social Media + Lead Enrichment
    print("\n🔗 STEP 2: SOCIAL MEDIA EXTRACTION & LEAD ENRICHMENT")
    print("=" * 70)
    
    final_results = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        
        page = context.new_page()
        
        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            window.chrome = { runtime: {} };
        """)
        
        social_scraper = SocialMediaScraper()
        
        for i, company in enumerate(companies, 1):
            print(f"\n[{i}/{len(companies)}] Processing: {company['name']}")
            print("-" * 70)
            
            # Extract social media
            print("🔗 Extracting social media links...")
            try:
                social_links = social_scraper.extract_social_links(
                    page, 
                    company['website'], 
                    company['name']
                )
                
                linkedin_found = "✅" if social_links.get('linkedin') else "❌"
                print(f"   LinkedIn: {linkedin_found}")
                
                other_socials = sum(1 for k, v in social_links.items() if k != 'linkedin' and v)
                if other_socials > 0:
                    print(f"   Other platforms: {other_socials} found")
                    
            except Exception as e:
                print(f"   ⚠️  Social media extraction failed: {str(e)[:50]}")
                social_links = {}
            
            # Enrich with decision makers
            print("👔 Enriching with decision maker data...")
            try:
                enrichment_data = enrich_company(
                    company['name'],
                    company['website'],
                    company.get('address')
                )
                
                dm_count = len(enrichment_data.get('decision_makers', []))
                if dm_count > 0:
                    print(f"   ✅ Found {dm_count} decision maker(s)")
                else:
                    print(f"   ⚠️  No decision makers found")
                    
            except Exception as e:
                print(f"   ⚠️  Enrichment failed: {str(e)[:50]}")
                enrichment_data = {
                    'company_size': None,
                    'industry': None,
                    'decision_makers': []
                }
            
            # Apply company size filter if specified
            if enrichment_data.get('company_size'):
                print(f"   📏 Company Size: {enrichment_data.get('company_size')} employees")
            
            # Combine all data
            result = {
                'company_name': company['name'],
                'website': company['website'],
                'address': company.get('address', 'N/A'),
                'phone': company.get('phone', 'N/A'),
                'industry': enrichment_data.get('industry', industry),
                'company_size': enrichment_data.get('company_size', 'Unknown'),
                'linkedin': social_links.get('linkedin', 'Not Found'),
                'facebook': social_links.get('facebook', 'Not Found'),
                'twitter': social_links.get('twitter', 'Not Found'),
                'instagram': social_links.get('instagram', 'Not Found'),
                'youtube': social_links.get('youtube', 'Not Found'),
                'pinterest': social_links.get('pinterest', 'Not Found'),
                'tiktok': social_links.get('tiktok', 'Not Found'),
                'github': social_links.get('github', 'Not Found'),
                'decision_makers': enrichment_data.get('decision_makers', [])
            }
            
            final_results.append(result)
            
            # Rate limiting
            time.sleep(2)
        
        browser.close()
    
    return final_results


def meets_size_criteria(company_size, size_filter):
    """Check if company size meets the filter criteria"""
    size_ranges = {
        'small': (1, 50),
        'medium': (51, 500),
        'large': (501, 10000),
        'enterprise': (10001, 999999)
    }
    
    if size_filter.lower() in size_ranges:
        min_size, max_size = size_ranges[size_filter.lower()]
        return min_size <= company_size <= max_size
    
    return True


def save_results(results, filename='complete_leads.json'):
    """Save results to JSON file"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n💾 Results saved to: {filename}")


def save_results_csv(results, filename='complete_leads.csv'):
    """Save results to CSV file"""
    if not results:
        return
    
    # Flatten decision makers for CSV
    csv_rows = []
    for company in results:
        base_row = {
            'Company Name': company['company_name'],
            'Website': company['website'],
            'Address': company['address'],
            'Phone': company['phone'],
            'Industry': company['industry'],
            'Company Size': company['company_size'],
            'LinkedIn': company['linkedin'],
            'Facebook': company['facebook'],
            'Twitter': company['twitter'],
            'Instagram': company['instagram'],
            'YouTube': company['youtube'],
            'Pinterest': company['pinterest'],
            'TikTok': company['tiktok'],
            'GitHub': company['github'],
        }
        
        if company['decision_makers']:
            for dm in company['decision_makers']:
                row = base_row.copy()
                row.update({
                    'Decision Maker Name': dm.get('name', 'N/A'),
                    'Job Title': dm.get('job_title', 'N/A'),
                    'Email': dm.get('email', 'N/A'),
                    'DM Phone': dm.get('phone', 'N/A'),
                    'DM LinkedIn': dm.get('linkedin', 'N/A')
                })
                csv_rows.append(row)
        else:
            base_row.update({
                'Decision Maker Name': 'N/A',
                'Job Title': 'N/A',
                'Email': 'N/A',
                'DM Phone': 'N/A',
                'DM LinkedIn': 'N/A'
            })
            csv_rows.append(base_row)
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        if csv_rows:
            writer = csv.DictWriter(f, fieldnames=csv_rows[0].keys())
            writer.writeheader()
            writer.writerows(csv_rows)
    
    print(f"💾 CSV saved to: {filename}")


def display_summary(results):
    """Display pipeline summary"""
    print("\n" + "=" * 80)
    print("📊 PIPELINE SUMMARY")
    print("=" * 80)
    
    total_companies = len(results)
    companies_with_linkedin = sum(1 for r in results if r['linkedin'] != 'Not Found')
    total_decision_makers = sum(len(r['decision_makers']) for r in results)
    companies_with_size = sum(1 for r in results if r['company_size'] != 'Unknown')
    
    print(f"\n✅ Total Companies Processed: {total_companies}")
    print(f"🔗 Companies with LinkedIn: {companies_with_linkedin}/{total_companies}")
    print(f"👔 Total Decision Makers Found: {total_decision_makers}")
    print(f"📏 Companies with Size Data: {companies_with_size}/{total_companies}")
    
    # Show sample results
    print(f"\n📋 Sample Results (First 3 Companies):")
    print("-" * 80)
    
    for i, company in enumerate(results[:3], 1):
        print(f"\n{i}. {company['company_name']}")
        print(f"   🌐 Website: {company['website']}")
        print(f"   📍 Address: {company['address'][:60]}...")
        print(f"   📊 Size: {company['company_size']}")
        print(f"   🔗 LinkedIn: {company['linkedin']}")
        
        if company['decision_makers']:
            print(f"   👔 Decision Makers ({len(company['decision_makers'])}):")
            for dm in company['decision_makers'][:2]:
                print(f"      • {dm.get('name')} - {dm.get('job_title')}")
                print(f"        📧 {dm.get('email', 'N/A')}")
    
    print("\n" + "=" * 80)


# ============================================
# MAIN EXECUTION
# ============================================
def main():
    """Main function"""
    print("\n" + "🎯 " + "=" * 74 + " 🎯")
    print("       COMPLETE LEAD GENERATION & ENRICHMENT PIPELINE")
    print("🎯 " + "=" * 74 + " 🎯\n")
    
    print("✨ Pipeline Steps:")
    print("   1️⃣  Scrape companies from Google Maps")
    print("   2️⃣  Extract social media profiles")
    print("   3️⃣  Enrich with decision maker data & company size")
    print("   4️⃣  Export complete dataset\n")
    
    # Get user input
    industry = input("📊 Industry (e.g., software, IT, healthcare): ").strip()
    location = input("📍 Location (e.g., Lahore, New York, London): ").strip()
    
    try:
        num_companies = int(input("🔢 How many companies? (default: 10): ").strip() or "10")
        num_companies = min(num_companies, 50)
    except ValueError:
        num_companies = 10
    
    # Run pipeline
    print("\n🚀 Starting pipeline...\n")
    results = run_complete_pipeline(industry, location, num_companies)
    
    if not results:
        print("\n❌ No results generated. Exiting...")
        return
    
    # Optional: Filter by company size AFTER enrichment
    print("\n" + "=" * 80)
    print("💼 COMPANY SIZE FILTERING (Optional)")
    print("=" * 80)
    print(f"\nYou have {len(results)} companies.")
    print("\nWould you like to filter by company size?")
    print("   • small (1-50 employees)")
    print("   • medium (51-500 employees)")
    print("   • large (501-10,000 employees)")
    print("   • enterprise (10,000+ employees)")
    
    size_filter = input("\nEnter size filter (or press Enter to keep all): ").strip().lower()
    
    if size_filter and size_filter in ['small', 'medium', 'large', 'enterprise']:
        original_count = len(results)
        results = [r for r in results if meets_size_criteria(r.get('company_size', 0), size_filter)]
        print(f"\n✅ Filtered from {original_count} to {len(results)} companies")
    
    if not results:
        print("\n⚠️ No companies match the size filter. Saving all results...")
        results = run_complete_pipeline(industry, location, num_companies)  # Re-run without filter
    
    # Display summary
    display_summary(results)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_filename = f"leads_{industry.replace(' ', '_')}_{timestamp}.json"
    csv_filename = f"leads_{industry.replace(' ', '_')}_{timestamp}.csv"
    
    save_results(results, json_filename)
    save_results_csv(results, csv_filename)
    
    print("\n✨ Pipeline Complete! ✨")
    print(f"\n📁 Files created:")
    print(f"   • {json_filename} (Complete JSON data)")
    print(f"   • {csv_filename} (Excel-friendly CSV)")
    print()


if __name__ == "__main__":
    main()