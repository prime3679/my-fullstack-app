import { db } from '../lib/db';

export interface MenuItemWithModifiers {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  prepTimeMinutes: number | null;
  isAvailable: boolean;
  is86: boolean;
  allergensJson: any;
  dietaryTags: string[];
  nutritionJson: any;
  sortOrder: number;
  category: {
    id: string;
    name: string;
  };
  modifierGroups: Array<{
    id: string;
    name: string;
    description: string | null;
    minSelections: number;
    maxSelections: number;
    isRequired: boolean;
    sortOrder: number;
    modifiers: Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      isAvailable: boolean;
      sortOrder: number;
    }>;
  }>;
}

export class MenuService {
  
  async getRestaurantMenu(restaurantId: string): Promise<{
    categories: Array<{
      id: string;
      name: string;
      description: string | null;
      sortOrder: number;
      items: MenuItemWithModifiers[];
    }>;
  }> {
    // First get all categories
    const categories = await db.menuCategory.findMany({
      where: {
        restaurantId,
        isActive: true
      },
      orderBy: {
        sortOrder: 'asc'
      },
      include: {
        menuItems: {
          where: {
            isAvailable: true,
            is86: false
          },
          orderBy: {
            sortOrder: 'asc'
          },
          include: {
            modifierGroups: {
              include: {
                modifierGroup: {
                  include: {
                    modifiers: {
                      where: {
                        isAvailable: true
                      },
                      orderBy: {
                        sortOrder: 'asc'
                      }
                    }
                  }
                }
              },
              orderBy: {
                sortOrder: 'asc'
              }
            }
          }
        }
      }
    });

    return {
      categories: categories.map((category: any) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        items: category.menuItems.map((item: any) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl,
          prepTimeMinutes: item.prepTimeMinutes,
          isAvailable: item.isAvailable,
          is86: item.is86,
          allergensJson: item.allergensJson,
          dietaryTags: item.dietaryTags,
          nutritionJson: item.nutritionJson,
          sortOrder: item.sortOrder,
          category: {
            id: category.id,
            name: category.name
          },
          modifierGroups: item.modifierGroups.map((mg: any) => ({
            id: mg.modifierGroup.id,
            name: mg.modifierGroup.name,
            description: mg.modifierGroup.description,
            minSelections: mg.modifierGroup.minSelections,
            maxSelections: mg.modifierGroup.maxSelections,
            isRequired: mg.isRequired,
            sortOrder: mg.sortOrder,
            modifiers: mg.modifierGroup.modifiers.map((modifier: any) => ({
              id: modifier.id,
              name: modifier.name,
              description: modifier.description,
              price: modifier.price,
              isAvailable: modifier.isAvailable,
              sortOrder: modifier.sortOrder
            }))
          }))
        }))
      }))
    };
  }

  async getMenuItem(restaurantId: string, sku: string): Promise<MenuItemWithModifiers | null> {
    const item = await db.menuItem.findFirst({
      where: {
        restaurantId,
        sku,
        isAvailable: true,
        is86: false
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: {
                  where: {
                    isAvailable: true
                  },
                  orderBy: {
                    sortOrder: 'asc'
                  }
                }
              }
            }
          },
          orderBy: {
            sortOrder: 'asc'
          }
        }
      }
    });

    if (!item) {
      return null;
    }

    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      prepTimeMinutes: item.prepTimeMinutes,
      isAvailable: item.isAvailable,
      is86: item.is86,
      allergensJson: item.allergensJson,
      dietaryTags: item.dietaryTags,
      nutritionJson: item.nutritionJson,
      sortOrder: item.sortOrder,
      category: item.category,
      modifierGroups: item.modifierGroups.map((mg: any) => ({
        id: mg.modifierGroup.id,
        name: mg.modifierGroup.name,
        description: mg.modifierGroup.description,
        minSelections: mg.modifierGroup.minSelections,
        maxSelections: mg.modifierGroup.maxSelections,
        isRequired: mg.isRequired,
        sortOrder: mg.sortOrder,
        modifiers: mg.modifierGroup.modifiers.map((modifier: any) => ({
          id: modifier.id,
          name: modifier.name,
          description: modifier.description,
          price: modifier.price,
          isAvailable: modifier.isAvailable,
          sortOrder: modifier.sortOrder
        }))
      }))
    };
  }

  async searchMenuItems(
    restaurantId: string,
    query?: string,
    dietaryTags: string[] = [],
    excludeAllergens: string[] = []
  ): Promise<MenuItemWithModifiers[]> {
    const whereCondition: any = {
      restaurantId,
      isAvailable: true,
      is86: false
    };

    if (query) {
      whereCondition.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } }
      ];
    }

    if (dietaryTags.length > 0) {
      whereCondition.dietaryTags = {
        hasSome: dietaryTags
      };
    }

    // Note: Allergen filtering simplified for now
    // In a real implementation, you'd want proper JSON path querying
    if (excludeAllergens.length > 0) {
      // This would need more complex JSON querying in Prisma
      console.log('Allergen exclusion not yet implemented');
    }

    const items = await db.menuItem.findMany({
      where: whereCondition,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: {
                  where: {
                    isAvailable: true
                  },
                  orderBy: {
                    sortOrder: 'asc'
                  }
                }
              }
            }
          },
          orderBy: {
            sortOrder: 'asc'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return items.map((item: any) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      prepTimeMinutes: item.prepTimeMinutes,
      isAvailable: item.isAvailable,
      is86: item.is86,
      allergensJson: item.allergensJson,
      dietaryTags: item.dietaryTags,
      nutritionJson: item.nutritionJson,
      sortOrder: item.sortOrder,
      category: item.category,
      modifierGroups: item.modifierGroups.map((mg: any) => ({
        id: mg.modifierGroup.id,
        name: mg.modifierGroup.name,
        description: mg.modifierGroup.description,
        minSelections: mg.modifierGroup.minSelections,
        maxSelections: mg.modifierGroup.maxSelections,
        isRequired: mg.isRequired,
        sortOrder: mg.sortOrder,
        modifiers: mg.modifierGroup.modifiers.map((modifier: any) => ({
          id: modifier.id,
          name: modifier.name,
          description: modifier.description,
          price: modifier.price,
          isAvailable: modifier.isAvailable,
          sortOrder: modifier.sortOrder
        }))
      }))
    }));
  }

  // Staff management methods
  async toggleItemAvailability(restaurantId: string, sku: string): Promise<MenuItemWithModifiers | null> {
    const item = await db.menuItem.findFirst({
      where: { restaurantId, sku }
    });

    if (!item) {
      throw new Error('Menu item not found');
    }

    const updated = await db.menuItem.update({
      where: { id: item.id },
      data: {
        isAvailable: !item.isAvailable
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: {
                  where: {
                    isAvailable: true
                  },
                  orderBy: {
                    sortOrder: 'asc'
                  }
                }
              }
            }
          },
          orderBy: {
            sortOrder: 'asc'
          }
        }
      }
    });

    return {
      id: updated.id,
      sku: updated.sku,
      name: updated.name,
      description: updated.description,
      price: updated.price,
      imageUrl: updated.imageUrl,
      prepTimeMinutes: updated.prepTimeMinutes,
      isAvailable: updated.isAvailable,
      is86: updated.is86,
      allergensJson: updated.allergensJson,
      dietaryTags: updated.dietaryTags,
      nutritionJson: updated.nutritionJson,
      sortOrder: updated.sortOrder,
      category: updated.category,
      modifierGroups: updated.modifierGroups.map((mg: any) => ({
        id: mg.modifierGroup.id,
        name: mg.modifierGroup.name,
        description: mg.modifierGroup.description,
        minSelections: mg.modifierGroup.minSelections,
        maxSelections: mg.modifierGroup.maxSelections,
        isRequired: mg.isRequired,
        sortOrder: mg.sortOrder,
        modifiers: mg.modifierGroup.modifiers.map((modifier: any) => ({
          id: modifier.id,
          name: modifier.name,
          description: modifier.description,
          price: modifier.price,
          isAvailable: modifier.isAvailable,
          sortOrder: modifier.sortOrder
        }))
      }))
    };
  }

  async getMenuItemsByDietaryRestrictions(
    restaurantId: string,
    dietaryTags: string[] = [],
    excludeAllergens: string[] = []
  ): Promise<MenuItemWithModifiers[]> {
    return this.searchMenuItems(restaurantId, undefined, dietaryTags, excludeAllergens);
  }

  async toggleItem86Status(
    restaurantId: string, 
    sku: string, 
    is86: boolean, 
    reason?: string
  ): Promise<MenuItemWithModifiers | null> {
    const item = await db.menuItem.findFirst({
      where: { restaurantId, sku }
    });

    if (!item) {
      throw new Error('Menu item not found');
    }

    const updated = await db.menuItem.update({
      where: { id: item.id },
      data: { is86 },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: {
                  where: {
                    isAvailable: true
                  },
                  orderBy: {
                    sortOrder: 'asc'
                  }
                }
              }
            }
          },
          orderBy: {
            sortOrder: 'asc'
          }
        }
      }
    });

    return {
      id: updated.id,
      sku: updated.sku,
      name: updated.name,
      description: updated.description,
      price: updated.price,
      imageUrl: updated.imageUrl,
      prepTimeMinutes: updated.prepTimeMinutes,
      isAvailable: updated.isAvailable,
      is86: updated.is86,
      allergensJson: updated.allergensJson,
      dietaryTags: updated.dietaryTags,
      nutritionJson: updated.nutritionJson,
      sortOrder: updated.sortOrder,
      category: updated.category,
      modifierGroups: updated.modifierGroups.map((mg: any) => ({
        id: mg.modifierGroup.id,
        name: mg.modifierGroup.name,
        description: mg.modifierGroup.description,
        minSelections: mg.modifierGroup.minSelections,
        maxSelections: mg.modifierGroup.maxSelections,
        isRequired: mg.isRequired,
        sortOrder: mg.sortOrder,
        modifiers: mg.modifierGroup.modifiers.map((modifier: any) => ({
          id: modifier.id,
          name: modifier.name,
          description: modifier.description,
          price: modifier.price,
          isAvailable: modifier.isAvailable,
          sortOrder: modifier.sortOrder
        }))
      }))
    };
  }

  async updateMenuItemAvailability(
    restaurantId: string, 
    sku: string, 
    isAvailable: boolean
  ): Promise<MenuItemWithModifiers | null> {
    const item = await db.menuItem.findFirst({
      where: { restaurantId, sku }
    });

    if (!item) {
      throw new Error('Menu item not found');
    }

    const updated = await db.menuItem.update({
      where: { id: item.id },
      data: { isAvailable },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: {
                  where: {
                    isAvailable: true
                  },
                  orderBy: {
                    sortOrder: 'asc'
                  }
                }
              }
            }
          },
          orderBy: {
            sortOrder: 'asc'
          }
        }
      }
    });

    return {
      id: updated.id,
      sku: updated.sku,
      name: updated.name,
      description: updated.description,
      price: updated.price,
      imageUrl: updated.imageUrl,
      prepTimeMinutes: updated.prepTimeMinutes,
      isAvailable: updated.isAvailable,
      is86: updated.is86,
      allergensJson: updated.allergensJson,
      dietaryTags: updated.dietaryTags,
      nutritionJson: updated.nutritionJson,
      sortOrder: updated.sortOrder,
      category: updated.category,
      modifierGroups: updated.modifierGroups.map((mg: any) => ({
        id: mg.modifierGroup.id,
        name: mg.modifierGroup.name,
        description: mg.modifierGroup.description,
        minSelections: mg.modifierGroup.minSelections,
        maxSelections: mg.modifierGroup.maxSelections,
        isRequired: mg.isRequired,
        sortOrder: mg.sortOrder,
        modifiers: mg.modifierGroup.modifiers.map((modifier: any) => ({
          id: modifier.id,
          name: modifier.name,
          description: modifier.description,
          price: modifier.price,
          isAvailable: modifier.isAvailable,
          sortOrder: modifier.sortOrder
        }))
      }))
    };
  }

  async toggle86Status(restaurantId: string, sku: string): Promise<MenuItemWithModifiers | null> {
    const item = await db.menuItem.findFirst({
      where: { restaurantId, sku }
    });

    if (!item) {
      throw new Error('Menu item not found');
    }

    const updated = await db.menuItem.update({
      where: { id: item.id },
      data: {
        is86: !item.is86
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: {
                  where: {
                    isAvailable: true
                  },
                  orderBy: {
                    sortOrder: 'asc'
                  }
                }
              }
            }
          },
          orderBy: {
            sortOrder: 'asc'
          }
        }
      }
    });

    return {
      id: updated.id,
      sku: updated.sku,
      name: updated.name,
      description: updated.description,
      price: updated.price,
      imageUrl: updated.imageUrl,
      prepTimeMinutes: updated.prepTimeMinutes,
      isAvailable: updated.isAvailable,
      is86: updated.is86,
      allergensJson: updated.allergensJson,
      dietaryTags: updated.dietaryTags,
      nutritionJson: updated.nutritionJson,
      sortOrder: updated.sortOrder,
      category: updated.category,
      modifierGroups: updated.modifierGroups.map((mg: any) => ({
        id: mg.modifierGroup.id,
        name: mg.modifierGroup.name,
        description: mg.modifierGroup.description,
        minSelections: mg.modifierGroup.minSelections,
        maxSelections: mg.modifierGroup.maxSelections,
        isRequired: mg.isRequired,
        sortOrder: mg.sortOrder,
        modifiers: mg.modifierGroup.modifiers.map((modifier: any) => ({
          id: modifier.id,
          name: modifier.name,
          description: modifier.description,
          price: modifier.price,
          isAvailable: modifier.isAvailable,
          sortOrder: modifier.sortOrder
        }))
      }))
    };
  }
}