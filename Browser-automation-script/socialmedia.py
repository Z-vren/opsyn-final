from playwright.sync_api import sync_playwright
import time
import random
import re
from urllib.parse import urlparse

class SocialMediaScraper:
    def __init__(self):
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
        """Random delay to simulate human behavior"""
        time.sleep(random.uniform(min_sec, max_sec))
    
    def random_mouse_movement(self, page):
        """Simulate random mouse movements"""
        try:
            for _ in range(random.randint(2, 4)):
                x = random.randint(100, 1000)
                y = random.randint(100, 700)
                page.mouse.move(x, y)
                time.sleep(random.uniform(0.1, 0.3))
        except:
            pass
    
    def human_scroll(self, page):
        """Simulate human-like scrolling behavior"""
        try:
            print("  🖱️  Scrolling through page...")
            
            # Get page height
            page_height = page.evaluate("document.body.scrollHeight")
            viewport_height = page.evaluate("window.innerHeight")
            
            current_position = 0
            scroll_count = 0
            max_scrolls = random.randint(8, 15)
            
            while current_position < page_height and scroll_count < max_scrolls:
                # Random scroll distance (sometimes small, sometimes large)
                if random.random() < 0.3:
                    # Small scroll
                    scroll_distance = random.randint(100, 300)
                else:
                    # Medium to large scroll
                    scroll_distance = random.randint(300, 800)
                
                # Scroll down
                page.evaluate(f"window.scrollBy(0, {scroll_distance})")
                current_position += scroll_distance
                scroll_count += 1
                
                # Random pause (simulate reading)
                pause_time = random.uniform(0.5, 2.0)
                if random.random() < 0.2:  # 20% chance of longer pause
                    pause_time = random.uniform(2.0, 4.0)
                time.sleep(pause_time)
                
                # Occasionally scroll up a bit (like a user re-reading)
                if random.random() < 0.25:
                    scroll_up = random.randint(50, 200)
                    page.evaluate(f"window.scrollBy(0, -{scroll_up})")
                    current_position -= scroll_up
                    time.sleep(random.uniform(0.3, 0.8))
                
                # Random mouse movement
                if random.random() < 0.4:
                    self.random_mouse_movement(page)
                
                # Update page height (in case content loaded)
                page_height = page.evaluate("document.body.scrollHeight")
            
            # Scroll back to top gradually
            print("  ⬆️  Scrolling back to top...")
            while current_position > 0:
                scroll_up = random.randint(400, 800)
                page.evaluate(f"window.scrollBy(0, -{scroll_up})")
                current_position -= scroll_up
                time.sleep(random.uniform(0.3, 0.8))
            
            # Final scroll to ensure we're at top
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(random.uniform(0.5, 1.0))
            
        except Exception as e:
            print(f"  ⚠️  Scroll error: {str(e)[:50]}")
    
    def extract_social_links(self, page, url):
        """Extract social media links from the page"""
        print(f"\n🔍 Analyzing website: {url}")
        print("=" * 70)
        
        try:
            # Navigate to website
            print("🌐 Loading website...")
            page.goto(url, wait_until='domcontentloaded', timeout=30000)
            
            # Wait and simulate human behavior
            self.human_delay(2, 4)
            
            # Random mouse movements at start
            self.random_mouse_movement(page)
            self.human_delay(1, 2)
            
            # Human-like scrolling
            self.human_scroll(page)
            
            # Additional random behavior
            self.human_delay(1, 2)
            self.random_mouse_movement(page)
            
            print("\n🔎 Searching for social media links...")
            
            # Get all links from the page
            all_links = page.evaluate("""
                () => {
                    const links = Array.from(document.querySelectorAll('a[href]'));
                    return links.map(a => a.href);
                }
            """)
            
            # Patterns for social media platforms
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
            
            # Search for social media links
            found_count = 0
            for link in all_links:
                for platform, pattern in patterns.items():
                    if re.search(pattern, link, re.IGNORECASE):
                        # Clean the link
                        clean_link = link.split('?')[0].split('#')[0]
                        
                        # Avoid duplicates and unwanted links
                        if (not self.social_links[platform] and 
                            'sharer' not in clean_link.lower() and
                            'share' not in clean_link.lower() and
                            'intent' not in clean_link.lower()):
                            
                            self.social_links[platform] = clean_link
                            found_count += 1
            
            # Also check in page source for hidden links
            page_content = page.content()
            for platform, pattern in patterns.items():
                if not self.social_links[platform]:
                    matches = re.findall(pattern, page_content, re.IGNORECASE)
                    for match in matches:
                        clean_link = match.split('?')[0].split('#')[0].strip('"\'')
                        if ('sharer' not in clean_link.lower() and 
                            'share' not in clean_link.lower() and
                            'intent' not in clean_link.lower()):
                            
                            # Ensure it's a complete URL
                            if not clean_link.startswith('http'):
                                clean_link = 'https://' + clean_link
                            
                            self.social_links[platform] = clean_link
                            found_count += 1
                            break
            
            # Simulate more human behavior before closing
            self.human_delay(1, 2)
            self.random_mouse_movement(page)
            
            return found_count
            
        except Exception as e:
            print(f"❌ Error: {e}")
            return 0
    
    def display_results(self, url):
        """Display the found social media links"""
        print("\n" + "=" * 70)
        print("📊 SOCIAL MEDIA LINKS FOUND")
        print("=" * 70)
        print(f"\n🌐 Company Website: {url}\n")
        
        # LinkedIn is compulsory
        if self.social_links['linkedin']:
            print(f"✅ LinkedIn:   {self.social_links['linkedin']}")
        else:
            print(f"❌ LinkedIn:   Not Found (REQUIRED)")
        
        # Other platforms
        other_platforms = ['facebook', 'twitter', 'instagram', 'youtube', 
                          'pinterest', 'tiktok', 'github']
        
        found_others = False
        print("\n📱 Other Social Media:")
        
        for platform in other_platforms:
            if self.social_links[platform]:
                platform_name = platform.capitalize()
                if platform == 'twitter':
                    platform_name = 'Twitter/X'
                elif platform == 'github':
                    platform_name = 'GitHub'
                elif platform == 'youtube':
                    platform_name = 'YouTube'
                elif platform == 'tiktok':
                    platform_name = 'TikTok'
                
                print(f"   ✅ {platform_name:12} {self.social_links[platform]}")
                found_others = True
        
        if not found_others:
            print("   ℹ️  No other social media links found")
        
        print("\n" + "=" * 70)
        
        # Summary
        total_found = sum(1 for v in self.social_links.values() if v)
        print(f"\n📈 Total Links Found: {total_found}")
        
        if not self.social_links['linkedin']:
            print("⚠️  WARNING: LinkedIn link not found (This is required)")
        else:
            print("✅ LinkedIn link found successfully!")


def validate_url(url):
    """Validate and format URL"""
    url = url.strip()
    
    # Add https:// if not present
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    # Basic validation
    try:
        result = urlparse(url)
        if result.scheme and result.netloc:
            return url
        else:
            return None
    except:
        return None


def main():
    """Main function"""
    print("\n" + "🔗 " + "=" * 66 + " 🔗")
    print("      COMPANY SOCIAL MEDIA LINK SCRAPER - Find Social Profiles")
    print("🔗 " + "=" * 66 + " 🔗\n")
    
    print("✨ Features:")
    print("   ✓ Extracts LinkedIn (REQUIRED)")
    print("   ✓ Finds Facebook, Twitter/X, Instagram")
    print("   ✓ Discovers YouTube, TikTok, Pinterest, GitHub")
    print("   ✓ Human-like browsing behavior")
    print("   ✓ Undetectable bot activity\n")
    
    # Get website URL
    website_url = input("🌐 Enter company website URL (e.g., example.com or https://example.com): ").strip()
    
    # Validate URL
    website_url = validate_url(website_url)
    
    if not website_url:
        print("\n❌ Invalid URL format. Please enter a valid website URL.")
        return
    
    scraper = SocialMediaScraper()
    
    with sync_playwright() as p:
        print("\n🚀 Launching browser...")
        
        browser = p.chromium.launch(
            headless=False,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--start-maximized',
                '--disable-infobars',
                '--disable-notifications'
            ]
        )
        
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale='en-US',
            timezone_id='Asia/Karachi'
        )
        
        page = context.new_page()
        
        # Enhanced anti-detection
        page.add_init_script("""
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // Mock chrome object
            window.chrome = {
                runtime: {}
            };
            
            // Mock permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // Mock plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // Mock languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
        """)
        
        try:
            # Extract social media links
            found_count = scraper.extract_social_links(page, website_url)
            
            # Display results
            scraper.display_results(website_url)
            
            # Final message
            if found_count > 0:
                print(f"\n✨ Successfully found {found_count} social media link(s)!")
            else:
                print("\n⚠️  No social media links found on this website.")
                print("   Try checking the company's contact or about pages manually.")
            
        except Exception as e:
            print(f"\n❌ Error occurred: {e}")
        
        finally:
            print("\n⏳ Closing browser...")
            time.sleep(random.uniform(2, 3))
            browser.close()
    
    print("\n✨ Done! ✨\n")


if __name__ == "__main__":
    main()