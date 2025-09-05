import {
  reactExtension,
  BlockStack,
  InlineStack,
  Button,
  Image,
  Text,
  Banner,
  ScrollView,
  useApplyCartLinesChange,
  useCartLines,
  useApi,
  SkeletonImage,
  SkeletonText,
  Select,
} from '@shopify/ui-extensions-react/checkout';
import { useState, useEffect } from 'react';

export default reactExtension(
  'purchase.checkout.block.render',
  () => <Extension />,
);

// ------------------------

function Extension() {
  const applyCartLinesChange = useApplyCartLinesChange();
  const cartLines = useCartLines();
  const { query, i18n } = useApi();
  const [status, setStatus] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariants, setSelectedVariants] = useState({});

  const variantIds = [
    'gid://shopify/ProductVariant/44293023465684',
    'gid://shopify/ProductVariant/44290921103572',
    'gid://shopify/ProductVariant/44290921332948',
    'gid://shopify/ProductVariant/44290921726164',
  ];

  useEffect(() => {
    const fetchProductDetails = async () => {
      setLoading(true);
      try {
        const queryString = `
          query ($ids: [ID!]!) {
            nodes(ids: $ids) {
              ... on ProductVariant {
                id
                title
                priceV2 {
                  amount
                  currencyCode
                }
                image {
                  url
                  altText
                }
                product {
                  title
                }
              }
            }
          }
        `;

        const response = await query(queryString, {
          variables: { ids: variantIds },
        });

        const fetchedProducts = response.data.nodes.reduce((acc, node) => {
          const productTitle = node.product.title;
          const variant = {
            id: node.id,
            title: node.title,
            price: i18n.formatCurrency(node.priceV2.amount, { currency: node.priceV2.currencyCode }),
            image: node.image?.url || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png?format=webp&v=1530129081',
          };

          const existingProduct = acc.find((p) => p.heading === productTitle);
          if (existingProduct) {
            existingProduct.variants.push(variant);
          } else {
            acc.push({
              heading: productTitle,
              variants: [variant],
            });
          }
          return acc;
        }, []);

        const initialSelectedVariants = fetchedProducts.reduce((acc, product) => {
          acc[product.heading] = product.variants[0].id;
          return acc;
        }, {});

        setProducts(fetchedProducts);
        setSelectedVariants(initialSelectedVariants);
        setLoading(false);
      } catch (error) {
        setStatus({ type: 'critical', message: 'Failed to fetch product details' });
        console.error('Error fetching product details:', error);
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [query, i18n]);

  const cartVariantIds = new Set(cartLines.map((line) => line.merchandise.id));

  const handleAddToCart = async (variantId, heading) => {
    if (cartVariantIds.has(variantId)) {
      setStatus({ type: 'info', message: `${heading} is already in the cart` });
      console.log(`${heading} is already in the cart`);
      return;
    }

    try {
      const result = await applyCartLinesChange({
        type: 'addCartLine',
        merchandiseId: variantId,
        quantity: 1,
      });

      if (result.type === 'error') {
        setStatus({ type: 'critical', message: `Failed to add ${heading}: ${result.message}` });
        console.error(`Error adding ${heading} to cart:`, result.message);
      } else {
        setStatus({ type: 'success', message: `${heading} added to cart successfully` });
        console.log(`${heading} added to cart`);
      }
    } catch (error) {
      setStatus({ type: 'critical', message: `An unexpected error occurred while adding ${heading}` });
      console.error(`Unexpected error adding ${heading} to cart:`, error);
    }
  };

  const handleVariantChange = (productHeading, variantId) => {
    setSelectedVariants((prev) => ({
      ...prev,
      [productHeading]: variantId,
    }));
  };

  return (
    <BlockStack>
      {status && (
        <Banner status={status.type}>
          {status.message}
        </Banner>
      )}
      {loading ? (
        <ScrollView direction="inline" maxInlineSize="fill" padding="base">
          <InlineStack inlineAlignment="start" blockAlignment="center" spacing="base">
            {variantIds.map((_, index) => (
              <BlockStack
                key={index}
                border="base"
                cornerRadius="base"
                padding="base"
                maxInlineSize={300}
                minInlineSize={250}
              >
                <SkeletonImage maxInlineSize={250} />
                <BlockStack spacing="tight">
                  <SkeletonText inlineSize="large" />
                  <SkeletonText inlineSize="small" />
                </BlockStack>
                <Button disabled>Loading...</Button>
              </BlockStack>
            ))}
          </InlineStack>
        </ScrollView>
      ) : (
        <ScrollView direction="inline" maxInlineSize="fill" padding="base">
          <InlineStack inlineAlignment="start" blockAlignment="center" spacing="base">
            {products.map((product, index) => {
              const selectedVariant = product.variants.find(
                (variant) => variant.id === selectedVariants[product.heading]
              ) || product.variants[0];

              return (
                <BlockStack
                  key={index}
                  border="base"
                  cornerRadius="base"
                  padding="base"
                  maxInlineSize={300}
                  minInlineSize={250}
                >
                  <Image
                    source={selectedVariant.image}
                    accessibilityDescription={`${product.heading} image`}
                    maxInlineSize={250}
                  />
                  <BlockStack spacing="tight">
                    <Text size="large">{product.heading}</Text>
                    <Text size="medium">{selectedVariant.price}</Text>
                    {product.variants.length > 1 ? (
                      <Select
                        label="Select Variant"
                        value={selectedVariants[product.heading] || product.variants[0].id}
                        onChange={(value) => handleVariantChange(product.heading, value)}
                        options={product.variants.map((variant) => ({
                          value: variant.id,
                          label: `${variant.title} - ${variant.price}`,
                        }))}
                      />
                    ) : (
                      <Text size="small">{selectedVariant.title}</Text>
                    )}
                  </BlockStack>
                  <Button
                    onPress={() =>
                      handleAddToCart(selectedVariants[product.heading], product.heading)
                    }
                    disabled={cartVariantIds.has(selectedVariants[product.heading])}
                  >
                    {cartVariantIds.has(selectedVariants[product.heading]) ? 'In Cart' : 'Add to Cart'}
                  </Button>
                </BlockStack>
              );
            })}
          </InlineStack>
        </ScrollView>
      )}
    </BlockStack>
  );
}