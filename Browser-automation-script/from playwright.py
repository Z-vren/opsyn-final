from playwright.sync_api import sync_playwright
import time
import random
import csv
import re

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
            print("    📜 Scrolling to load more results...")
            for i in range(8):  # Scroll multiple times
                page.evaluate(f'''
                    const container = document.querySelector("{container_selector}");
                    if (container) {{
                        container.scrollBy(0, container.clientHeight);
                    }}
                ''')
                time.sleep(scroll_pause_time)
                
                # Check if we've reached the end
                is_end = page.evaluate(f'''
                    const container = document.querySelector("{container_selector}");
                    container ? (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) : true
                ''')
                
                if is_end and i > 3:
                    print(f"    ✅ Reached end of results after {i+1} scrolls")
                    break
                    
        except Exception as e:
            print(f"    ⚠️  Scroll error: {str(e)[:50]}")
    
    def extract_website_from_detail_panel(self, page):
        """Extract the actual website URL from the company detail panel"""
        try:
            # Wait a bit for the panel to load
            time.sleep(1.5)
            
            # Method 1: Look for the website button/link
            website_selectors = [
                'a[data-item-id="authority"]',
                'a[aria-label*="Website"]',
                'a[data-tooltip*="website" i]',
                'button[data-item-id="authority"]',
                'a[href*="http"]:has-text("Website")',
            ]
            
            for selector in website_selectors:
                try:
                    elements = page.locator(selector).all()
                    for elem in elements:
                        href = elem.get_attribute('href')
                        if href and href.startswith('http') and 'google.com' not in href:
                            # Clean up the URL
                            if '/url?q=' in href:
                                href = href.split('/url?q=')[1].split('&')[0]
                            return href
                except:
                    continue
            
            # Method 2: Click on website button if it exists
            try:
                website_button = page.locator('button[data-item-id="authority"]').first
                if website_button.count() > 0:
                    # Get the data-value or aria-label
                    aria_label = website_button.get_attribute('aria-label')
                    if aria_label:
                        # Extract URL from aria-label
                        url_match = re.search(r'(https?://[^\s]+)', aria_label)
                        if url_match:
                            return url_match.group(1)
            except:
                pass
            
            # Method 3: Look in all links in the detail panel
            try:
                all_links = page.locator('div[role="main"] a[href^="http"]').all()
                for link in all_links:
                    href = link.get_attribute('href')
                    if href and 'google.com' not in href and 'maps' not in href:
                        return href
            except:
                pass
            
            return None
            
        except Exception as e:
            return None
    
    def extract_company_from_listing(self, page, listing, index):
        """Click a listing and extract all company details"""
        try:
            # Get the company name from the listing before clicking
            company_name = None
            try:
                name_elem = listing.locator('div[class*="fontHeadlineSmall"]').first
                if name_elem.count() > 0:
                    company_name = name_elem.inner_text(timeout=1000).strip()
            except:
                pass
            
            if not company_name:
                return None
            
            print(f"    🔍 Checking: {company_name}")
            
            # Click the listing to open detail panel
            listing.click(timeout=3000)
            self.human_delay(2, 3)  # Wait for panel to load
            
            company_data = {
                'name': company_name,
                'website': None,
                'address': None,
                'phone': None
            }
            
            # Extract website
            company_data['website'] = self.extract_website_from_detail_panel(page)
            
            # Extract address
            try:
                address_button = page.locator('button[data-item-id="address"]').first
                if address_button.count() > 0:
                    addr_text = address_button.get_attribute('aria-label')
                    if addr_text and 'Address:' in addr_text:
                        company_data['address'] = addr_text.replace('Address:', '').strip()
                    else:
                        company_data['address'] = address_button.inner_text(timeout=1000).strip()
            except:
                pass
            
            # Extract phone
            try:
                phone_selectors = [
                    'button[data-item-id*="phone"]',
                    'button[aria-label*="Phone"]'
                ]
                for selector in phone_selectors:
                    phone_elem = page.locator(selector).first
                    if phone_elem.count() > 0:
                        phone_text = phone_elem.get_attribute('aria-label')
                        if phone_text and 'Phone:' in phone_text:
                            company_data['phone'] = phone_text.replace('Phone:', '').strip()
                        else:
                            company_data['phone'] = phone_elem.inner_text(timeout=1000).strip()
                        break
            except:
                pass
            
            return company_data
            
        except Exception as e:
            print(f"    ⚠️  Error extracting: {str(e)[:50]}")
            return None
    
    def scrape_google_maps(self, industry, location, num_companies=10):
        """
        Scrape companies from Google Maps
        """
        print(f"\n🗺️  Starting Google Maps scraping for {num_companies} {industry} companies in {location}...")
        print("=" * 70)
        
        with sync_playwright() as p:
            print("\n🌐 Launching browser...")
            
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
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                locale='en-US',
                timezone_id='Asia/Karachi',
                geolocation={'latitude': 31.5204, 'longitude': 74.3587},
                permissions=['geolocation']
            )
            
            page = context.new_page()
            
            # Anti-detection
            page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
                window.chrome = { runtime: {} };
            """)
            
            try:
                # Go to Google Maps
                print("📍 Opening Google Maps...")
                page.goto('https://www.google.com/maps', wait_until='domcontentloaded', timeout=30000)
                self.human_delay(2, 3)
                
                # Handle cookie consent
                try:
                    consent_selectors = [
                        'button:has-text("Accept all")',
                        'button:has-text("Reject all")',
                        'form:has-text("Accept") button'
                    ]
                    for selector in consent_selectors:
                        try:
                            btn = page.locator(selector).first
                            if btn.count() > 0:
                                btn.click()
                                self.human_delay(1, 2)
                                break
                        except:
                            continue
                except:
                    pass
                
                # Search for companies
                print("🔍 Searching for companies...")
                search_query = f"{industry} companies in {location}"
                
                try:
                    search_box = page.locator('input[id="searchboxinput"]').first
                    search_box.click()
                    self.human_delay(0.5, 1)
                    
                    print(f"⌨️  Typing: '{search_query}'")
                    self.type_like_human(page, search_query)
                    self.human_delay(1, 1.5)
                    
                    page.keyboard.press('Enter')
                    print("⏳ Loading results...")
                    
                    # Wait for results
                    page.wait_for_timeout(4000)
                    self.human_delay(2, 3)
                    
                except Exception as e:
                    print(f"❌ Search error: {e}")
                    return
                
                # Scroll to load all results
                results_container = 'div[role="feed"]'
                self.smooth_scroll(page, results_container, scroll_pause_time=2.5)
                
                # Get all listings
                print("\n📊 Extracting company details...\n")
                
                # Wait a moment for all results to render
                time.sleep(2)
                
                listings = page.locator('div[role="feed"] > div > div[class]').all()
                print(f"    Found {len(listings)} total listings\n")
                
                companies_extracted = 0
                
                for i, listing in enumerate(listings):
                    if companies_extracted >= num_companies:
                        break
                    
                    try:
                        # Skip if it doesn't look like a company listing
                        if listing.locator('div[class*="fontHeadlineSmall"]').count() == 0:
                            continue
                        
                        company_data = self.extract_company_from_listing(page, listing, i)
                        
                        if company_data and company_data['name']:
                            # Check for duplicates
                            if any(c['Company Name'].lower() == company_data['name'].lower() 
                                  for c in self.companies):
                                print(f"    ⏭️  Duplicate, skipping\n")
                                continue
                            
                            final_data = {
                                'Company Name': company_data['name'],
                                'Website URL': company_data['website'] if company_data['website'] else 'N/A',
                                'Industry': industry,
                                'Location': company_data['address'] if company_data['address'] else location
                            }
                            
                            self.companies.append(final_data)
                            companies_extracted += 1
                            
                            print(f"    ✅ {companies_extracted}. {company_data['name']}")
                            if company_data['website']:
                                print(f"       🌐 Website: {company_data['website']}")
                            if company_data['phone']:
                                print(f"       📞 Phone: {company_data['phone']}")
                            if company_data['address']:
                                print(f"       📍 Address: {company_data['address'][:60]}...")
                            print()
                            
                            # Small delay before next
                            self.human_delay(0.3, 0.8)
                    
                    except Exception as e:
                        print(f"    ⚠️  Skipped listing {i+1}: {str(e)[:50]}\n")
                        continue
                
                print(f"\n✨ Successfully scraped {len(self.companies)} companies!")
                
                if len(self.companies) == 0:
                    print("\n⚠️  No companies extracted. This might be because:")
                    print("   • Google Maps interface changed")
                    print("   • No results found for this search")
                    print("   • Try a different industry or location")
                
            except Exception as e:
                print(f"❌ Error: {e}")
            
            finally:
                print("\n⏳ Closing browser...")
                self.human_delay(2, 3)
                browser.close()
    
    def save_to_csv(self, filename='companies.csv'):
        """Save to CSV"""
        if not self.companies:
            print("⚠️  No companies to save!")
            return
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['Company Name', 'Website URL', 'Industry', 'Location'])
            writer.writeheader()
            writer.writerows(self.companies)
        
        print(f"💾 Data saved to {filename}")
    
    def display_results(self):
        """Display results"""
        if not self.companies:
            print("\n⚠️  No companies found!")
            return
        
        print("\n" + "=" * 120)
        print(f"{'#':<4} {'Company Name':<40} {'Website URL':<50} {'Industry':<10}")
        print("=" * 120)
        
        for i, company in enumerate(self.companies, 1):
            name = company['Company Name'][:38]
            url = company['Website URL'][:48]
            industry = company['Industry'][:8]
            print(f"{i:<4} {name:<40} {url:<50} {industry:<10}")
        
        print("=" * 120)


def main():
    """Main function"""
    print("\n" + "🗺️ " + "=" * 56 + " 🗺️")
    print("   GOOGLE MAPS COMPANY SCRAPER - Real Business Data")
    print("🗺️ " + "=" * 56 + " 🗺️\n")
    
    print("✨ Features:")
    print("   ✓ Extracts REAL company websites")
    print("   ✓ Company phone numbers")
    print("   ✓ Full business addresses")
    print("   ✓ Verified business listings\n")
    
    scraper = GoogleMapsScraper()
    
    industry = input("📊 Industry (e.g., software, IT, restaurant): ").strip()
    location = input("📍 Location (e.g., Lahore, Karachi, Islamabad): ").strip()
    
    try:
        num_companies = int(input("🔢 How many companies? (default: 10, max: 50): ").strip() or "10")
        num_companies = min(num_companies, 50)
    except ValueError:
        num_companies = 10
    
    scraper.scrape_google_maps(industry, location, num_companies)
    scraper.display_results()
    
    if scraper.companies:
        save = input("\n💾 Save to CSV? (y/n): ").strip().lower()
        if save == 'y':
            filename = input("Filename (default: companies.csv): ").strip() or "companies.csv"
            if not filename.endswith('.csv'):
                filename += '.csv'
            scraper.save_to_csv(filename)
    
    print("\n✨ Done! ✨\n")


if __name__ == "__main__":
    main()