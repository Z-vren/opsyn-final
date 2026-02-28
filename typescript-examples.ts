/**
 * TypeScript Basics - Practical Examples
 * 
 * This file demonstrates TypeScript concepts with examples
 * that mirror patterns used in the Activepieces project.
 * 
 * Run this file with: npx ts-node typescript-examples.ts
 * Or compile it: npx tsc typescript-examples.ts
 */

// ============================================================================
// 1. BASIC TYPES
// ============================================================================

// Primitive types
let userName: string = "John Doe";
let userAge: number = 30;
let isActive: boolean = true;

// Type inference (TypeScript guesses the type)
let inferredString = "Hello";  // TypeScript knows this is string
let inferredNumber = 42;       // TypeScript knows this is number

// ============================================================================
// 2. FUNCTIONS
// ============================================================================

// Basic function with types
function greet(name: string): string {
  return `Hello, ${name}`;
}

// Function with optional parameter
function createUser(name: string, age?: number): void {
  console.log(`Creating user: ${name}`);
  if (age !== undefined) {
    console.log(`Age: ${age}`);
  }
}

// Function with default parameter
function formatMessage(message: string, prefix: string = "INFO"): string {
  return `[${prefix}] ${message}`;
}

// Arrow function
const add = (a: number, b: number): number => {
  return a + b;
};

// Arrow function shorthand
const multiply = (a: number, b: number): number => a * b;

// ============================================================================
// 3. OBJECTS AND INTERFACES
// ============================================================================

// Define an interface (object shape)
interface User {
  id: string;
  name: string;
  email: string;
  age?: number;  // Optional property
}

// Use the interface
const user: User = {
  id: "user-123",
  name: "John Doe",
  email: "john@example.com",
  // age is optional, so we can omit it
};

// Interface with all properties
const userWithAge: User = {
  id: "user-456",
  name: "Jane Doe",
  email: "jane@example.com",
  age: 25,
};

// ============================================================================
// 4. TYPE ALIASES
// ============================================================================

// Create a type alias
type UserId = string;
type ProjectId = string;

// Use type aliases
let userId: UserId = "user-789";
let projectId: ProjectId = "project-123";

// Type alias for union type
type ID = string | number;
let id1: ID = "abc-123";
let id2: ID = 456;

// ============================================================================
// 5. ENUMS
// ============================================================================

// String enum (most common)
enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  PENDING = "PENDING",
}

enum PlatformRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
  OPERATOR = "OPERATOR",
}

// Use enums
let status: UserStatus = UserStatus.ACTIVE;
let role: PlatformRole = PlatformRole.ADMIN;

// ============================================================================
// 6. ARRAYS
// ============================================================================

// Array of strings
let names: string[] = ["John", "Jane", "Bob"];

// Alternative array syntax
let numbers: Array<number> = [1, 2, 3, 4, 5];

// Array of objects
let users: User[] = [
  { id: "1", name: "John", email: "john@example.com" },
  { id: "2", name: "Jane", email: "jane@example.com" },
];

// ============================================================================
// 7. UNION TYPES
// ============================================================================

// Can be string OR number
let identifier: string | number = "abc-123";
identifier = 456;  // Also valid

// Union of specific string values
type Status = "pending" | "active" | "inactive";
let currentStatus: Status = "active";

// Function with union parameter
function processId(id: string | number): string {
  // Type narrowing - check the type
  if (typeof id === "string") {
    return id.toUpperCase();
  } else {
    return id.toString();
  }
}

// ============================================================================
// 8. OPTIONAL PROPERTIES AND NULLABLE TYPES
// ============================================================================

interface Project {
  id: string;
  name: string;
  description?: string;  // Optional - can be omitted
  ownerId: string | null;  // Can be string OR null
}

const project1: Project = {
  id: "proj-1",
  name: "My Project",
  // description is optional, so we can omit it
  ownerId: "user-123",
};

const project2: Project = {
  id: "proj-2",
  name: "Another Project",
  description: "A detailed description",
  ownerId: null,  // Can be null
};

// ============================================================================
// 9. GENERICS
// ============================================================================

// Generic function - works with any type
function identity<T>(arg: T): T {
  return arg;
}

// Use the generic function
let stringResult = identity<string>("hello");
let numberResult = identity<number>(42);

// Generic function for arrays
function getFirst<T>(items: T[]): T | undefined {
  return items[0];
}

let firstString = getFirst<string>(["a", "b", "c"]);  // string | undefined
let firstNumber = getFirst<number>([1, 2, 3]);        // number | undefined

// Generic with constraints
function getProperty<T extends object>(obj: T, key: keyof T) {
  return obj[key];
}

const userObj = { name: "John", age: 30 };
let name = getProperty(userObj, "name");  // TypeScript knows this is string

// ============================================================================
// 10. TYPE GUARDS
// ============================================================================

// Type guard function
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

// Use type guards
function processValue(value: unknown): void {
  if (isString(value)) {
    // TypeScript knows value is string here
    console.log(value.toUpperCase());
  } else if (isNumber(value)) {
    // TypeScript knows value is number here
    console.log(value.toFixed(2));
  } else {
    console.log("Unknown type");
  }
}

// ============================================================================
// 11. COMPLEX EXAMPLE: MIMICKING YOUR PROJECT PATTERNS
// ============================================================================

// Example: User with status and role (like in your user.ts)
interface UserWithStatus {
  id: string;
  email: string;
  status: UserStatus;
  platformRole: PlatformRole;
  externalId: string | null;  // Nullable
}

// Example: Function that formats duration (like in your utils.ts)
function formatDuration(
  durationMs: number | undefined,
  short?: boolean
): string {
  if (durationMs === undefined) {
    return "-";
  }

  if (durationMs < 1000) {
    const ms = Math.floor(durationMs);
    return short ? `${ms} ms` : `${ms} milliseconds`;
  }

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);

  if (seconds < 60) {
    return short ? `${seconds} s` : `${seconds} seconds`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    if (remainingSeconds > 0) {
      return short
        ? `${minutes} min ${remainingSeconds} s`
        : `${minutes} minutes ${remainingSeconds} seconds`;
    }
    return short ? `${minutes} min` : `${minutes} minutes`;
  }

  return short ? `${seconds} s` : `${seconds} seconds`;
}

// Example: Component props pattern (like in your blocking-overlay.tsx)
type ButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

function Button({ label, onClick, disabled, className }: ButtonProps): string {
  const classes = className || "";
  const isDisabled = disabled || false;
  return `<button class="${classes}" ${isDisabled ? "disabled" : ""} onclick="${onClick.toString()}">${label}</button>`;
}

// Example: Union type for different data shapes
type FileData =
  | {
      content: string;
      type: "text" | "json" | "csv";
    }
  | {
      content: Buffer;
      type: "binary";
    };

function processFile(file: FileData): void {
  if (file.type === "binary") {
    // TypeScript knows file.content is Buffer here
    console.log(`Binary file, size: ${file.content.length} bytes`);
  } else {
    // TypeScript knows file.content is string here
    console.log(`Text file (${file.type}): ${file.content.substring(0, 50)}`);
  }
}

// ============================================================================
// 12. PRACTICAL USAGE EXAMPLES
// ============================================================================

// Example: API response handler
interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

async function fetchUser(userId: string): Promise<ApiResponse<User>> {
  // Simulated API call
  return {
    data: {
      id: userId,
      name: "John Doe",
      email: "john@example.com",
    },
    status: 200,
  };
}

// Example: Error handling with types
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function tryOperation<T>(
  operation: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// Usage
async function example() {
  const result = await tryOperation(() => fetchUser("user-123"));
  
  if (result.success) {
    // TypeScript knows result.data exists here
    console.log(result.data.name);
  } else {
    // TypeScript knows result.error exists here
    console.error(result.error.message);
  }
}

// ============================================================================
// 13. EXPORT/IMPORT PATTERNS (like in your project)
// ============================================================================

// Export types
export type { User, UserId, ProjectId };

// Export interfaces
export interface { UserWithStatus };

// Export enums
export { UserStatus, PlatformRole };

// Export functions
export function formatDuration(
  durationMs: number | undefined,
  short?: boolean
): string {
  // ... implementation
  return "";
}

// ============================================================================
// MAIN EXECUTION (for testing)
// ============================================================================

function main() {
  console.log("=== TypeScript Basics Examples ===\n");

  // Test basic types
  console.log("1. Basic Types:");
  console.log(`   userName: ${userName} (type: string)`);
  console.log(`   userAge: ${userAge} (type: number)`);
  console.log(`   isActive: ${isActive} (type: boolean)\n`);

  // Test functions
  console.log("2. Functions:");
  console.log(`   greet("World"): ${greet("World")}`);
  console.log(`   add(5, 3): ${add(5, 3)}`);
  console.log(`   multiply(4, 7): ${multiply(4, 7)}\n`);

  // Test enums
  console.log("3. Enums:");
  console.log(`   UserStatus.ACTIVE: ${UserStatus.ACTIVE}`);
  console.log(`   PlatformRole.ADMIN: ${PlatformRole.ADMIN}\n`);

  // Test union types
  console.log("4. Union Types:");
  console.log(`   processId("abc"): ${processId("abc")}`);
  console.log(`   processId(123): ${processId(123)}\n`);

  // Test formatDuration (like your utils)
  console.log("5. Format Duration:");
  console.log(`   formatDuration(5000): ${formatDuration(5000)}`);
  console.log(`   formatDuration(5000, true): ${formatDuration(5000, true)}`);
  console.log(`   formatDuration(undefined): ${formatDuration(undefined)}\n`);

  // Test type guards
  console.log("6. Type Guards:");
  processValue("hello");
  processValue(42);
  processValue(true);
}

// Uncomment to run:
// main();
