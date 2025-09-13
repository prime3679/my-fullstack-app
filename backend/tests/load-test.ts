import { performance } from 'perf_hooks';

interface LoadTestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errors: Array<{ error: string; count: number }>;
}

class LoadTester {
  private baseUrl: string;
  private results: LoadTestResult[] = [];

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<{
    success: boolean;
    duration: number;
    error?: string;
    status?: number;
  }> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      const duration = performance.now() - startTime;
      
      if (!response.ok) {
        return {
          success: false,
          duration,
          error: `HTTP ${response.status}`,
          status: response.status
        };
      }
      
      // Consume the response body to complete the request
      await response.text();
      
      return {
        success: true,
        duration,
        status: response.status
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      return {
        success: false,
        duration,
        error: (error as Error).message
      };
    }
  }

  async testEndpoint(
    endpoint: string,
    concurrency: number,
    totalRequests: number,
    options: RequestInit = {}
  ): Promise<LoadTestResult> {
    console.log(`🧪 Load testing ${endpoint} with ${concurrency} concurrent requests...`);
    
    const results: Array<{ success: boolean; duration: number; error?: string }> = [];
    const errors = new Map<string, number>();
    const startTime = performance.now();
    
    // Create batches of concurrent requests
    const batchSize = concurrency;
    const batches = Math.ceil(totalRequests / batchSize);
    
    for (let batch = 0; batch < batches; batch++) {
      const requestsInBatch = Math.min(batchSize, totalRequests - batch * batchSize);
      const batchPromises = [];
      
      for (let i = 0; i < requestsInBatch; i++) {
        batchPromises.push(this.makeRequest(endpoint, options));
      }
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to avoid overwhelming the server
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    const totalTime = performance.now() - startTime;
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.filter(r => !r.success).length;
    const durations = results.map(r => r.duration);
    
    // Count errors
    results.forEach(result => {
      if (!result.success && result.error) {
        errors.set(result.error, (errors.get(result.error) || 0) + 1);
      }
    });
    
    const result: LoadTestResult = {
      endpoint,
      totalRequests: results.length,
      successfulRequests,
      failedRequests,
      averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      minResponseTime: Math.min(...durations),
      maxResponseTime: Math.max(...durations),
      requestsPerSecond: results.length / (totalTime / 1000),
      errors: Array.from(errors.entries()).map(([error, count]) => ({ error, count }))
    };
    
    this.results.push(result);
    return result;
  }

  async simulateRestaurantTraffic(): Promise<void> {
    console.log('🏭 Starting restaurant traffic simulation...\n');
    
    // Test 1: Health check (should be very fast)
    await this.testEndpoint('/api/health', 10, 50);
    
    // Test 2: Restaurant listing (common page)
    await this.testEndpoint('/api/restaurants', 20, 100);
    
    // Test 3: Kitchen dashboard (high-frequency updates)
    const restaurantId = 'cmfhahzn10000un0ifrqljetp'; // Default test restaurant
    await this.testEndpoint(`/api/v1/kitchen/tickets?restaurantId=${restaurantId}`, 15, 75);
    
    // Test 4: Kitchen stats (frequent polling)
    await this.testEndpoint(`/api/v1/kitchen/dashboard?restaurantId=${restaurantId}`, 10, 60);
    
    // Test 5: Reservation creation simulation (POST requests)
    const reservationPayload = {
      restaurantId,
      partySize: 4,
      startAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      source: 'lacarta'
    };
    
    await this.testEndpoint('/api/v1/reservations', 5, 25, {
      method: 'POST',
      body: JSON.stringify(reservationPayload)
    });
    
    console.log('\\n📊 Load test results summary:\\n');
    this.printResults();
  }

  async simulateRushHour(): Promise<void> {
    console.log('🚨 Simulating dinner rush hour traffic...\n');
    
    const restaurantId = 'cmfhahzn10000un0ifrqljetp';
    
    // Simulate concurrent operations during peak hour
    const rushPromises = [
      // Multiple kitchen dashboards open
      this.testEndpoint(`/api/v1/kitchen/dashboard?restaurantId=${restaurantId}`, 25, 200),
      
      // Active kitchen ticket updates
      this.testEndpoint(`/api/v1/kitchen/tickets?restaurantId=${restaurantId}`, 30, 150),
      
      // Customers browsing restaurants
      this.testEndpoint('/api/restaurants', 40, 300),
      
      // Health checks from monitoring systems
      this.testEndpoint('/api/health', 50, 500)
    ];
    
    console.log('⏱️  Running concurrent rush hour simulation...');
    const startTime = performance.now();
    
    await Promise.all(rushPromises);
    
    const totalTime = performance.now() - startTime;
    console.log(`\\n⚡ Rush hour simulation completed in ${(totalTime / 1000).toFixed(2)}s\\n`);
    
    console.log('📊 Rush hour results:\\n');
    this.printResults();
  }

  private printResults(): void {
    this.results.forEach((result, index) => {
      const successRate = ((result.successfulRequests / result.totalRequests) * 100).toFixed(1);
      
      console.log(`${index + 1}. ${result.endpoint}`);
      console.log(`   📈 Success Rate: ${successRate}% (${result.successfulRequests}/${result.totalRequests})`);
      console.log(`   ⚡ Avg Response Time: ${result.averageResponseTime.toFixed(1)}ms`);
      console.log(`   📊 Min/Max: ${result.minResponseTime.toFixed(1)}ms / ${result.maxResponseTime.toFixed(1)}ms`);
      console.log(`   🔄 Requests/sec: ${result.requestsPerSecond.toFixed(1)}`);
      
      if (result.errors.length > 0) {
        console.log(`   ❌ Errors:`);
        result.errors.forEach(error => {
          console.log(`      ${error.error}: ${error.count} occurrences`);
        });
      }
      console.log();
    });
    
    // Overall statistics
    const totalRequests = this.results.reduce((sum, r) => sum + r.totalRequests, 0);
    const totalSuccessful = this.results.reduce((sum, r) => sum + r.successfulRequests, 0);
    const overallSuccessRate = ((totalSuccessful / totalRequests) * 100).toFixed(1);
    
    console.log(`🎯 Overall Success Rate: ${overallSuccessRate}% (${totalSuccessful}/${totalRequests} requests)`);
    console.log(`📊 Fastest endpoint: ${this.results.reduce((min, r) => r.averageResponseTime < min.averageResponseTime ? r : min).endpoint}`);
    console.log(`🐌 Slowest endpoint: ${this.results.reduce((max, r) => r.averageResponseTime > max.averageResponseTime ? r : max).endpoint}`);
  }

  clearResults(): void {
    this.results = [];
  }
}

// Main execution
async function runLoadTests() {
  const tester = new LoadTester();
  
  try {
    console.log('🚀 Starting La Carta Load Tests\\n');
    
    // Run normal traffic simulation
    await tester.simulateRestaurantTraffic();
    
    console.log('\\n' + '='.repeat(60) + '\\n');
    
    // Clear results and run rush hour simulation
    tester.clearResults();
    await tester.simulateRushHour();
    
    console.log('✅ Load tests completed successfully');
    
  } catch (error) {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runLoadTests();
}

export { LoadTester, runLoadTests };