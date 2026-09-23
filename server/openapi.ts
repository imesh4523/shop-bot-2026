export function getOpenApiSpec(baseUrl: string = "/") {
  let isHttp = baseUrl.startsWith("http://") || baseUrl.startsWith("https://");
  let currentHostServer = isHttp ? baseUrl : "/";
  let apiSubdomain = "https://api.youuhost.store";

  if (isHttp) {
    try {
      const u = new URL(baseUrl);
      if (!u.hostname.includes("localhost") && !u.hostname.includes("127.0.0.1")) {
        const parts = u.hostname.split(".");
        if (parts.length >= 2 && !parts[0].startsWith("api")) {
          apiSubdomain = `${u.protocol}//api.${u.hostname}`;
        } else {
          apiSubdomain = baseUrl;
        }
      }
    } catch {}
  }

  return {
    ...openApiSpec,
    info: {
      ...openApiSpec.info,
      description: `Official REST API for **youuhost** cloud store.\n\n## Authentication\nSend your API key in the \`X-API-Key\` header on every request.\nGenerate or manage keys from the Telegram bot (\`/api\`) or your Admin Dashboard.\n\n## Rate limits\nMaximum **5 requests / second** per API key.\n\n## Base URL\n- **Current Host**: \`${currentHostServer}\`\n- **API Subdomain**: \`${apiSubdomain}\``,
    },
    servers: [
      {
        url: "/",
        description: "Current Host (Default & Direct In-Browser Testing)"
      },
      ...(isHttp ? [{ url: baseUrl, description: "Main Domain Server" }] : []),
      {
        url: apiSubdomain,
        description: "API Subdomain (api.domain.com)"
      }
    ]
  };
}

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "youuhost API",
    description: `Official REST API for **youuhost** cloud store.\n\n## Authentication\nSend your API key in the \`X-API-Key\` header on every request.\nGenerate or manage keys from the Telegram bot (\`/api\`) or your Admin Dashboard.\n\n## Rate limits\nMaximum **5 requests / second** per API key.\n\n## Base URL\n\`/api/v1\``,
    version: "1.0.0",
    contact: {
      name: "youuhost Support",
      url: "https://t.me/rochana_imesh"
    }
  },
  servers: [
    {
      url: "/",
      description: "Current Host (Direct Testing)"
    },
    {
      url: "https://api.youuhost.store",
      description: "API Subdomain"
    }
  ],
  tags: [
    { name: "Account", description: "Balance & profile information" },
    { name: "Catalog", description: "List products with real-time stock & prices" },
    { name: "Orders", description: "Place orders with instant delivery or batch purchase" },
    { name: "Preorders", description: "Track pre-order fulfillment status" },
    { name: "Stats", description: "API Key usage statistics and revenue" }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "Your personal API key from the Telegram bot or Admin Dashboard"
      }
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string", example: "unauthorized" },
          message: { type: "string", example: "Invalid or missing API key." },
          statusCode: { type: "integer", example: 401 }
        }
      },
      UserProfile: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              id: { type: "integer", example: 104 },
              telegram_id: { type: "string", example: "78291048" },
              username: { type: "string", nullable: true, example: "alex_dev" },
              first_name: { type: "string", nullable: true, example: "Alex" },
              balance_cents: { type: "integer", example: 2500 },
              balance_usd: { type: "string", example: "25.00" },
              currency: { type: "string", example: "USD" },
              referral_balance_cents: { type: "integer", example: 300 },
              created_at: { type: "string", format: "date-time", example: "2026-08-15T12:00:00Z" }
            }
          }
        }
      },
      ProductItem: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "AWS $10K Credit Account" },
          description: { type: "string", example: "Full warranty AWS account with $10K credits" },
          category: { type: "string", example: "AWS" },
          price_cents: { type: "integer", example: 6500 },
          price_usd: { type: "string", example: "65.00" },
          status: { type: "string", example: "available" },
          stock: { type: "integer", example: 14 },
          is_in_stock: { type: "boolean", example: true },
          is_preorder_enabled: { type: "boolean", example: false },
          preorder_quota: { type: "integer", example: 50 }
        }
      },
      ProductListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          count: { type: "integer", example: 1 },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/ProductItem" }
          }
        }
      },
      SingleOrderRequest: {
        type: "object",
        required: ["product_id"],
        properties: {
          product_id: { type: "integer", example: 1, description: "ID of the product to purchase" },
          quantity: { type: "integer", minimum: 1, default: 1, example: 1, description: "Quantity of items to purchase" }
        }
      },
      SingleOrderResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          type: { type: "string", enum: ["instant", "preorder"], example: "instant" },
          message: { type: "string", example: "Order completed successfully." },
          data: {
            type: "object",
            properties: {
              order_ids: { type: "array", items: { type: "integer" }, example: [4821] },
              product_name: { type: "string", example: "AWS $10K Credit Account" },
              quantity: { type: "integer", example: 1 },
              total_price_usd: { type: "string", example: "65.00" },
              delivered_items: {
                type: "array",
                items: { type: "string" },
                example: ["aws_access_key: AKIAIOSFODNN7EXAMPLE | secret: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"]
              },
              created_at: { type: "string", format: "date-time", example: "2026-09-22T15:00:00Z" }
            }
          }
        }
      },
      BatchOrderItem: {
        type: "object",
        required: ["product_id"],
        properties: {
          product_id: { type: "integer", example: 1 },
          quantity: { type: "integer", minimum: 1, default: 1, example: 2 }
        }
      },
      BatchOrderRequest: {
        type: "object",
        required: ["orders"],
        properties: {
          orders: {
            type: "array",
            items: { $ref: "#/components/schemas/BatchOrderItem" }
          }
        }
      },
      BatchOrderResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          processed_count: { type: "integer", example: 2 },
          data: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: { type: "integer", example: 1 },
                product_name: { type: "string", example: "AWS $10K Credit Account" },
                success: { type: "boolean", example: true },
                delivered_items: { type: "array", items: { type: "string" } },
                error: { type: "string", nullable: true }
              }
            }
          }
        }
      },
      OrderHistoryItem: {
        type: "object",
        properties: {
          id: { type: "integer", example: 4821 },
          product_id: { type: "integer", example: 1 },
          product_name: { type: "string", example: "AWS $10K Credit Account" },
          price_cents: { type: "integer", example: 6500 },
          price_usd: { type: "string", example: "65.00" },
          status: { type: "string", example: "completed" },
          delivered_content: { type: "string", nullable: true, example: "email:pass:secret" },
          created_at: { type: "string", format: "date-time", example: "2026-09-22T15:00:00Z" }
        }
      },
      OrderHistoryResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          count: { type: "integer", example: 1 },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/OrderHistoryItem" }
          }
        }
      },
      SingleOrderDetailsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: { $ref: "#/components/schemas/OrderHistoryItem" }
        }
      },
      PreorderStatusResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              id: { type: "integer", example: 12 },
              product_id: { type: "integer", example: 2 },
              product_name: { type: "string", example: "DigitalOcean $200 Account" },
              amount_usd: { type: "string", example: "12.00" },
              status: { type: "string", enum: ["pending", "fulfilled", "cancelled"], example: "pending" },
              delivered_content: { type: "string", nullable: true },
              fulfilled_at: { type: "string", nullable: true, format: "date-time" },
              created_at: { type: "string", format: "date-time" }
            }
          }
        }
      },
      ApiKeyStatsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              key: { type: "string", example: "ric_a89bc2e14f9d…" },
              full_key: { type: "string", example: "ric_a89bc2e14f9d78291048590184bdf89e1" },
              status: { type: "string", example: "active" },
              total_orders: { type: "integer", example: 42 },
              success_orders: { type: "integer", example: 40 },
              failed_orders: { type: "integer", example: 2 },
              revenue_usd: { type: "string", example: "1820.00" },
              last_used_at: { type: "string", nullable: true, format: "date-time" },
              created_at: { type: "string", format: "date-time" }
            }
          }
        }
      }
    }
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/api/v1/me": {
      get: {
        tags: ["Account"],
        summary: "Get account & wallet balance",
        operationId: "getMe",
        description: "Returns profile information, Telegram user ID, and current live balance in USD and cents.",
        responses: {
          200: {
            description: "Profile and balance information retrieved successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserProfile" }
              }
            }
          },
          401: {
            description: "Missing or invalid API key.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          403: {
            description: "API key revoked or user banned.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/v1/products": {
      get: {
        tags: ["Catalog"],
        summary: "List products with live stock & prices",
        operationId: "listProducts",
        description: "Returns all store products along with real-time stock count, category, and pre-order availability.",
        responses: {
          200: {
            description: "List of products",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductListResponse" }
              }
            }
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/v1/order": {
      post: {
        tags: ["Orders"],
        summary: "Place a single purchase order",
        operationId: "createOrder",
        description: "Purchases a product using your wallet balance. If stock is available, credentials are delivered immediately. If pre-order is enabled and stock is 0, creates a pre-order reservation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SingleOrderRequest" }
            }
          }
        },
        responses: {
          200: {
            description: "Order completed with delivered account credentials (or queued preorder).",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SingleOrderResponse" }
              }
            }
          },
          400: {
            description: "Invalid input or product is out of stock.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          402: {
            description: "Insufficient wallet balance.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          404: {
            description: "Product not found.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/v1/batch-order": {
      post: {
        tags: ["Orders"],
        summary: "Place multiple orders in batch",
        operationId: "createBatchOrder",
        description: "Submit multiple product purchases in one atomic API request.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BatchOrderRequest" }
            }
          }
        },
        responses: {
          200: {
            description: "Batch orders processed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BatchOrderResponse" }
              }
            }
          },
          400: {
            description: "Invalid parameters",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/v1/orders": {
      get: {
        tags: ["Orders"],
        summary: "Order history for this API key",
        operationId: "listOrders",
        description: "Retrieve all completed purchases placed by this API key, including delivered credentials.",
        responses: {
          200: {
            description: "List of orders",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderHistoryResponse" }
              }
            }
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/v1/order/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Get single order details by ID",
        operationId: "getOrder",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "Order ID"
          }
        ],
        responses: {
          200: {
            description: "Order details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SingleOrderDetailsResponse" }
              }
            }
          },
          404: {
            description: "Order not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/v1/pending/{id}": {
      get: {
        tags: ["Preorders"],
        summary: "Get pre-order approval & fulfillment status",
        operationId: "getPreorderStatus",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "Pre-order ID"
          }
        ],
        responses: {
          200: {
            description: "Preorder status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PreorderStatusResponse" }
              }
            }
          },
          404: {
            description: "Pre-order not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/v1/stats": {
      get: {
        tags: ["Stats"],
        summary: "API key statistics and order metrics",
        operationId: "getStats",
        description: "Returns lifetime order counts, success rate, and total spend for this API key.",
        responses: {
          200: {
            description: "API key metrics",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiKeyStatsResponse" }
              }
            }
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    }
  }
};
